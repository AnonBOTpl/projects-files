/**
 * actions.js — Biblioteka gotowych, sprawdzonych akcji bota.
 *
 * Każda akcja:
 *  - przyjmuje (bot, params) i zwraca { success: bool, message: string }
 *  - ma wbudowany timeout (domyślnie 30s)
 *  - nigdy nie rzuca wyjątkiem — łapie błędy i zwraca { success: false }
 *  - loguje co robi przez logToGUI
 */

const { goals } = require('mineflayer-pathfinder');
const vec3 = require('vec3');
const { logToGUI } = require('./gui');

// ─── Helper: timeout wrapper ───────────────────────────────────────────────────
function withTimeout(promise, ms = 30000, label = 'akcja') {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout (${ms}ms): ${label}`)), ms)
        )
    ]);
}

// ─── Helper: znajdź blok danego typu w zasięgu ────────────────────────────────
function findBlock(bot, blockName, maxDistance = 32) {
    const mcData = require('minecraft-data')(bot.version);
    const blockType = mcData.blocksByName[blockName];
    if (!blockType) return null;
    return bot.findBlock({ matching: blockType.id, maxDistance });
}

// ─── Helper: sprawdź czy bot ma item w ekwipunku ──────────────────────────────
function countInInventory(bot, itemName) {
    const mcData = require('minecraft-data')(bot.version);
    const item = mcData.itemsByName[itemName] || mcData.blocksByName[itemName];
    if (!item) return 0;
    return bot.inventory.items()
        .filter(i => i.type === item.id)
        .reduce((sum, i) => sum + i.count, 0);
}

// ─── Helper: idź do pozycji ───────────────────────────────────────────────────
async function gotoPosition(bot, x, y, z, range = 2) {
    await bot.pathfinder.goto(new goals.GoalNear(x, y, z, range));
}

// ─── Helper: bezpieczne postawienie bloku ────────────────────────────────────
async function placeBlockSafely(bot, targetPos, itemName) {
    const mcData = require('minecraft-data')(bot.version);
    const itemInfo = mcData.itemsByName[itemName] || mcData.blocksByName[itemName];
    if (!itemInfo) throw new Error(`Nieznany blok: ${itemName}`);

    const invItem = bot.inventory.items().find(i => i.type === itemInfo.id);
    if (!invItem) throw new Error(`Brak ${itemName} w ekwipunku`);

    // Podejdź w pobliże ale nie za blisko
    await gotoPosition(bot, targetPos.x, targetPos.y, targetPos.z, 3);
    await bot.equip(invItem, 'hand');
    await new Promise(r => setTimeout(r, 300));

    // Szukamy bloku referencyjnego (pod lub obok)
    const refBelow = bot.blockAt(targetPos.offset(0, -1, 0));
    if (refBelow && refBelow.name !== 'air') {
        await bot.placeBlock(refBelow, vec3(0, 1, 0));
        return;
    }

    const sides = [
        { off: vec3(1,0,0),  face: vec3(-1,0,0) },
        { off: vec3(-1,0,0), face: vec3(1,0,0)  },
        { off: vec3(0,0,1),  face: vec3(0,0,-1) },
        { off: vec3(0,0,-1), face: vec3(0,0,1)  },
        { off: vec3(0,1,0),  face: vec3(0,-1,0) },
    ];
    for (const { off, face } of sides) {
        const ref = bot.blockAt(targetPos.plus(off));
        if (ref && ref.name !== 'air') {
            await bot.placeBlock(ref, face);
            return;
        }
    }
    throw new Error('Nie ma bloku referencyjnego do przyczepiania');
}


// ═══════════════════════════════════════════════════════════════════════════════
// AKCJE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * mine_block — Wykop N bloków danego typu
 * @param {object} params
 * @param {string} params.block_type  - np. "iron_ore", "oak_log", "coal_ore"
 * @param {number} params.count       - ile bloków wykopać (domyślnie 1)
 */
async function mine_block(bot, params) {
    const { block_type, count = 1 } = params;
    logToGUI('system', `[AKCJA] mine_block: ${count}x ${block_type}`);

    try {
        let mined = 0;
        while (mined < count) {
            const block = findBlock(bot, block_type, 64);
            if (!block) {
                return { success: false, message: `Nie znalazłem ${block_type} w zasięgu 64 bloków` };
            }

            // Sprawdź czy to nie blok pod nogami
            const botPos = bot.entity.position.floored();
            if (block.position.equals(botPos.offset(0, -1, 0))) {
                return { success: false, message: 'Blok jest pod moimi nogami — pomijam' };
            }

            await withTimeout(
                (async () => {
                    await bot.tool.equipForBlock(block);
                    await bot.pathfinder.goto(new goals.GoalLookAtBlock(block.position, bot.world));
                    await bot.dig(block);
                })(),
                20000,
                `kopanie ${block_type}`
            );

            mined++;
            logToGUI('system', `[AKCJA] Wykopano ${mined}/${count} ${block_type}`);
            await new Promise(r => setTimeout(r, 200));
        }
        return { success: true, message: `Wykopano ${count}x ${block_type}` };
    } catch (e) {
        return { success: false, message: `Błąd kopania: ${e.message}` };
    }
}

/**
 * collect_items — Podnieś leżące na ziemi przedmioty w pobliżu
 * @param {object} params
 * @param {string} [params.item_name] - opcjonalnie filtruj po nazwie itemu
 * @param {number} [params.max_distance] - zasięg (domyślnie 16)
 */
async function collect_items(bot, params) {
    const { item_name, max_distance = 16 } = params;
    logToGUI('system', `[AKCJA] collect_items: ${item_name || 'wszystko'}`);

    try {
        const mcData = require('minecraft-data')(bot.version);
        let droppedItems = Object.values(bot.entities).filter(e =>
            e.type === 'object' && e.objectType === 'Item' &&
            bot.entity.position.distanceTo(e.position) < max_distance
        );

        if (item_name) {
            const itemId = mcData.itemsByName[item_name]?.id;
            droppedItems = droppedItems.filter(e =>
                e.metadata && e.metadata[8]?.itemId === itemId
            );
        }

        if (droppedItems.length === 0) {
            return { success: false, message: 'Brak przedmiotów do podniesienia' };
        }

        // Posortuj po odległości
        droppedItems.sort((a, b) =>
            bot.entity.position.distanceTo(a.position) -
            bot.entity.position.distanceTo(b.position)
        );

        let collected = 0;
        for (const item of droppedItems) {
            await withTimeout(
                gotoPosition(bot, item.position.x, item.position.y, item.position.z, 1),
                10000,
                'podchodzenie do itemu'
            );
            collected++;
            await new Promise(r => setTimeout(r, 300));
        }

        return { success: true, message: `Podniesiono ${collected} przedmiotów` };
    } catch (e) {
        return { success: false, message: `Błąd zbierania: ${e.message}` };
    }
}

/**
 * goto_position — Idź do podanych współrzędnych
 * @param {object} params
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} params.z
 * @param {number} [params.range] - dopuszczalny dystans od celu (domyślnie 2)
 */
async function goto_position(bot, params) {
    const { x, y, z, range = 2 } = params;
    logToGUI('system', `[AKCJA] goto_position: (${x}, ${y}, ${z})`);

    try {
        await withTimeout(
            gotoPosition(bot, x, y, z, range),
            60000,
            `idź do (${x},${y},${z})`
        );
        return { success: true, message: `Dotarłem do (${x}, ${y}, ${z})` };
    } catch (e) {
        return { success: false, message: `Nie mogę dojść: ${e.message}` };
    }
}

/**
 * goto_block — Podejdź do najbliższego bloku danego typu
 * @param {object} params
 * @param {string} params.block_type
 * @param {number} [params.max_distance]
 * @param {number} [params.range]
 */
async function goto_block(bot, params) {
    const { block_type, max_distance = 64, range = 3 } = params;
    logToGUI('system', `[AKCJA] goto_block: ${block_type}`);

    try {
        const block = findBlock(bot, block_type, max_distance);
        if (!block) return { success: false, message: `Nie znalazłem ${block_type}` };

        await withTimeout(
            gotoPosition(bot, block.position.x, block.position.y, block.position.z, range),
            30000,
            `idź do ${block_type}`
        );
        return { success: true, message: `Dotarłem do ${block_type} na (${block.position.x}, ${block.position.y}, ${block.position.z})` };
    } catch (e) {
        return { success: false, message: `Nie mogę dojść do ${block_type}: ${e.message}` };
    }
}

/**
 * craft_item — Skraftuj przedmiot
 * @param {object} params
 * @param {string} params.item_name  - np. "crafting_table", "wooden_pickaxe"
 * @param {number} [params.count]    - ile sztuk (domyślnie 1)
 */
async function craft_item(bot, params) {
    const { item_name, count = 1 } = params;
    logToGUI('system', `[AKCJA] craft_item: ${count}x ${item_name}`);

    try {
        const mcData = require('minecraft-data')(bot.version);
        const itemInfo = mcData.itemsByName[item_name];
        if (!itemInfo) return { success: false, message: `Nieznany przedmiot: ${item_name}` };

        // Szukamy crafting table w pobliżu
        let tableBlock = findBlock(bot, 'crafting_table', 32);

        // Sprawdź czy przepis wymaga stołu
        const recipesNoTable = bot.recipesFor(itemInfo.id, null, 1, null);
        const recipesWithTable = tableBlock ? bot.recipesFor(itemInfo.id, null, 1, tableBlock) : [];

        if (recipesNoTable.length > 0) {
            // Można bez stołu (2x2)
            await bot.craft(recipesNoTable[0], count, null);
            return { success: true, message: `Skraftowano ${count}x ${item_name}` };
        } else if (recipesWithTable.length > 0) {
            // Potrzebny stół
            await withTimeout(
                gotoPosition(bot, tableBlock.position.x, tableBlock.position.y, tableBlock.position.z, 3),
                20000, 'idź do crafting table'
            );
            await bot.craft(recipesWithTable[0], count, tableBlock);
            return { success: true, message: `Skraftowano ${count}x ${item_name} przy stole` };
        } else {
            return { success: false, message: `Brak surowców lub przepisu na ${item_name}` };
        }
    } catch (e) {
        return { success: false, message: `Błąd craftingu: ${e.message}` };
    }
}

/**
 * place_block — Postaw blok przy sobie
 * @param {object} params
 * @param {string} params.item_name   - np. "crafting_table", "furnace"
 * @param {number} [params.dx]        - offset od bota (domyślnie 2, 0, 0)
 * @param {number} [params.dy]
 * @param {number} [params.dz]
 */
async function place_block(bot, params) {
    const { item_name, dx = 2, dy = 0, dz = 0 } = params;
    logToGUI('system', `[AKCJA] place_block: ${item_name} na offset (${dx},${dy},${dz})`);

    try {
        const count = countInInventory(bot, item_name);
        if (count === 0) return { success: false, message: `Brak ${item_name} w ekwipunku` };

        const botPos = bot.entity.position.floored();
        const targetPos = botPos.offset(dx, dy, dz);

        await withTimeout(
            placeBlockSafely(bot, targetPos, item_name),
            15000,
            `stawianie ${item_name}`
        );
        await new Promise(r => setTimeout(r, 500));
        return { success: true, message: `Postawiono ${item_name}` };
    } catch (e) {
        return { success: false, message: `Błąd stawiania: ${e.message}` };
    }
}

/**
 * smelt_items — Przetop przedmioty w piecu
 * @param {object} params
 * @param {string} params.input_item   - np. "raw_iron", "raw_gold", "oak_log"
 * @param {string} [params.fuel_item]  - np. "coal", "oak_log" (domyślnie "coal")
 * @param {number} [params.count]      - ile sztuk (domyślnie 1)
 */
async function smelt_items(bot, params) {
    const { input_item, fuel_item = 'coal', count = 1 } = params;
    logToGUI('system', `[AKCJA] smelt_items: ${count}x ${input_item} paliwem ${fuel_item}`);

    try {
        const mcData = require('minecraft-data')(bot.version);

        // Sprawdź ekwipunek
        const inputCount = countInInventory(bot, input_item);
        if (inputCount < count) {
            return { success: false, message: `Za mało ${input_item}: mam ${inputCount}, potrzebuję ${count}` };
        }
        const fuelCount = countInInventory(bot, fuel_item);
        if (fuelCount === 0) {
            return { success: false, message: `Brak paliwa: ${fuel_item}` };
        }

        // Szukaj pieca
        let furnaceBlock = findBlock(bot, 'furnace', 32) || findBlock(bot, 'lit_furnace', 32);
        if (!furnaceBlock) {
            // Spróbuj postawić piec jeśli mamy
            if (countInInventory(bot, 'furnace') > 0) {
                const placeResult = await place_block(bot, { item_name: 'furnace', dx: 2 });
                if (!placeResult.success) return { success: false, message: 'Brak pieca i nie mogę go postawić' };
                await new Promise(r => setTimeout(r, 1000));
                furnaceBlock = findBlock(bot, 'furnace', 32);
            } else {
                return { success: false, message: 'Brak pieca w pobliżu i w ekwipunku' };
            }
        }

        // Podejdź do pieca
        await withTimeout(
            gotoPosition(bot, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 3),
            20000, 'idź do pieca'
        );

        const furnace = await withTimeout(
            bot.openFurnace(furnaceBlock),
            10000, 'otwieranie pieca'
        );

        const inputId = mcData.itemsByName[input_item]?.id;
        const fuelId  = mcData.itemsByName[fuel_item]?.id;

        if (!inputId) { furnace.close(); return { success: false, message: `Nieznany item: ${input_item}` }; }
        if (!fuelId)  { furnace.close(); return { success: false, message: `Nieznane paliwo: ${fuel_item}` }; }

        await furnace.putFuel(fuelId, null, Math.min(fuelCount, count));
        await furnace.putInput(inputId, null, count);

        // Czekaj na przetopienie (10s na item + 2s bufora)
        const waitTime = count * 10000 + 2000;
        logToGUI('system', `[AKCJA] Czekam ${waitTime/1000}s na przetopienie...`);
        await new Promise(r => setTimeout(r, waitTime));

        await furnace.takeOutput();
        furnace.close();

        return { success: true, message: `Przetopiono ${count}x ${input_item}` };
    } catch (e) {
        return { success: false, message: `Błąd przetapiania: ${e.message}` };
    }
}

/**
 * eat_food — Zjedz jedzenie z ekwipunku
 * @param {object} params
 * @param {string} [params.food_item] - konkretny food; jeśli puste, wybiera najlepsze z eq
 */
async function eat_food(bot, params) {
    const { food_item } = params;
    logToGUI('system', `[AKCJA] eat_food: ${food_item || 'najlepsze dostępne'}`);

    // Priorytet jedzenia (im wyżej tym lepsze)
    const foodPriority = [
        'golden_carrot', 'cooked_porkchop', 'cooked_beef', 'cooked_chicken',
        'cooked_mutton', 'cooked_salmon', 'cooked_cod', 'bread',
        'carrot', 'potato', 'apple', 'melon_slice', 'cookie',
        'porkchop', 'beef', 'chicken', 'raw_salmon', 'raw_cod'
    ];

    try {
        let targetFood = food_item;

        if (!targetFood) {
            // Znajdź najlepsze jedzenie w ekwipunku
            for (const food of foodPriority) {
                if (countInInventory(bot, food) > 0) {
                    targetFood = food;
                    break;
                }
            }
        }

        if (!targetFood) return { success: false, message: 'Brak jedzenia w ekwipunku' };

        const mcData = require('minecraft-data')(bot.version);
        const itemInfo = mcData.itemsByName[targetFood];
        if (!itemInfo) return { success: false, message: `Nieznany item: ${targetFood}` };

        const invItem = bot.inventory.items().find(i => i.type === itemInfo.id);
        if (!invItem) return { success: false, message: `Brak ${targetFood} w ekwipunku` };

        await bot.equip(invItem, 'hand');
        await bot.consume();

        return { success: true, message: `Zjedzono ${targetFood}` };
    } catch (e) {
        return { success: false, message: `Błąd jedzenia: ${e.message}` };
    }
}

/**
 * attack_entity — Zaatakuj pobliskiego moba lub gracza
 * @param {object} params
 * @param {string} [params.entity_name] - np. "zombie", "skeleton", "pig"
 * @param {number} [params.max_distance]
 */
async function attack_entity(bot, params) {
    const { entity_name, max_distance = 16 } = params;
    logToGUI('system', `[AKCJA] attack_entity: ${entity_name || 'najbliższy hostile'}`);

    try {
        // Dobierz narzędzie/broń
        const sword = bot.inventory.items().find(i =>
            i.name.includes('sword') || i.name.includes('axe')
        );
        if (sword) await bot.equip(sword, 'hand');

        let target;
        if (entity_name) {
            target = bot.nearestEntity(e =>
                e.name === entity_name &&
                bot.entity.position.distanceTo(e.position) < max_distance
            );
        } else {
            // Najgroźniejszy w pobliżu
            const hostiles = ['zombie','skeleton','creeper','spider','enderman','phantom','drowned','husk','witch'];
            target = bot.nearestEntity(e =>
                hostiles.includes(e.name) &&
                bot.entity.position.distanceTo(e.position) < max_distance
            );
        }

        if (!target) return { success: false, message: `Nie znalazłem ${entity_name || 'wroga'} w pobliżu` };

        // Podejdź i zaatakuj przez pvp plugin
        await withTimeout(
            gotoPosition(bot, target.position.x, target.position.y, target.position.z, 3),
            15000, 'idź do celu'
        );

        bot.pvp.attack(target);

        // Czekaj aż mob zginie (max 20s)
        await withTimeout(
            new Promise(resolve => {
                const check = setInterval(() => {
                    if (!target || !bot.entities[target.id]) {
                        clearInterval(check);
                        resolve();
                    }
                }, 500);
            }),
            20000, 'walka'
        );

        bot.pvp.stop();
        return { success: true, message: `Zabiłem ${entity_name || 'wroga'}` };
    } catch (e) {
        bot.pvp.stop();
        return { success: false, message: `Błąd ataku: ${e.message}` };
    }
}

/**
 * flee_from_entity — Uciekaj od groźnego moba
 * @param {object} params
 * @param {string} [params.entity_name]
 * @param {number} [params.distance] - na ile bloków uciec (domyślnie 20)
 */
async function flee_from_entity(bot, params) {
    const { entity_name, distance = 20 } = params;
    logToGUI('system', `[AKCJA] flee_from_entity: od ${entity_name || 'wroga'}`);

    try {
        const hostiles = ['zombie','skeleton','creeper','spider','enderman','phantom','drowned','husk','witch'];
        const threat = bot.nearestEntity(e =>
            (entity_name ? e.name === entity_name : hostiles.includes(e.name)) &&
            bot.entity.position.distanceTo(e.position) < 32
        );

        if (!threat) return { success: false, message: 'Brak zagrożenia w pobliżu' };

        // Oblicz pozycję ucieczki — przeciwny kierunek od moba
        const dir = bot.entity.position.minus(threat.position).normalize();
        const fleeTarget = bot.entity.position.plus(dir.scaled(distance));

        await withTimeout(
            gotoPosition(bot, fleeTarget.x, fleeTarget.y, fleeTarget.z, 2),
            20000, 'ucieczka'
        );

        return { success: true, message: `Uciekłem od ${threat.name}` };
    } catch (e) {
        return { success: false, message: `Błąd ucieczki: ${e.message}` };
    }
}

/**
 * explore — Idź w losowym lub określonym kierunku żeby eksplorować
 * @param {object} params
 * @param {string} [params.direction] - "north" | "south" | "east" | "west" | "random"
 * @param {number} [params.distance]  - ile bloków (domyślnie 50)
 */
async function explore(bot, params) {
    const { direction = 'random', distance = 50 } = params;
    logToGUI('system', `[AKCJA] explore: ${direction} ${distance} bloków`);

    try {
        const pos = bot.entity.position;
        let dx = 0, dz = 0;

        switch (direction) {
            case 'north': dz = -distance; break;
            case 'south': dz =  distance; break;
            case 'east':  dx =  distance; break;
            case 'west':  dx = -distance; break;
            default: // random
                const angle = Math.random() * Math.PI * 2;
                dx = Math.floor(Math.cos(angle) * distance);
                dz = Math.floor(Math.sin(angle) * distance);
        }

        const target = { x: Math.floor(pos.x + dx), y: Math.floor(pos.y), z: Math.floor(pos.z + dz) };

        await withTimeout(
            bot.pathfinder.goto(new goals.GoalXZ(target.x, target.z)),
            60000, 'eksploracja'
        );

        return { success: true, message: `Eksploruję — dotarłem do (${target.x}, ?, ${target.z})` };
    } catch (e) {
        return { success: false, message: `Eksploracja przerwana: ${e.message}` };
    }
}

/**
 * look_around — Rozejrzyj się i zwróć co jest w pobliżu (do użycia przez AI)
 * Nie wykonuje żadnej akcji — tylko zbiera dane.
 */
async function look_around(bot, params) {
    const { max_distance = 32 } = params || {};
    logToGUI('system', '[AKCJA] look_around');

    try {
        const mcData = require('minecraft-data')(bot.version);

        // Skanuj bloki w pobliżu (interesujące typy)
        const interestingBlocks = [
            'iron_ore', 'gold_ore', 'diamond_ore', 'coal_ore',
            'copper_ore', 'emerald_ore', 'deepslate_iron_ore',
            'oak_log', 'birch_log', 'spruce_log',
            'crafting_table', 'furnace', 'chest',
            'water', 'lava',
        ];

        const found = [];
        for (const blockName of interestingBlocks) {
            const blockType = mcData.blocksByName[blockName];
            if (!blockType) continue;
            const block = bot.findBlock({ matching: blockType.id, maxDistance: max_distance });
            if (block) {
                found.push(`${blockName} w odległości ${Math.floor(bot.entity.position.distanceTo(block.position))} bloków`);
            }
        }

        // Skanuj byty
        const nearbyEntities = Object.values(bot.entities)
            .filter(e => e !== bot.entity && bot.entity.position.distanceTo(e.position) < max_distance)
            .map(e => e.name || e.type)
            .filter(Boolean);

        const entityMap = {};
        nearbyEntities.forEach(n => entityMap[n] = (entityMap[n] || 0) + 1);
        const entityStr = Object.entries(entityMap).map(([n, c]) => `${c}x ${n}`).join(', ');

        const summary = [
            found.length > 0 ? `Bloki: ${found.join(', ')}` : 'Brak interesujących bloków',
            entityStr ? `Byty: ${entityStr}` : 'Brak bytów'
        ].join(' | ');

        return { success: true, message: summary };
    } catch (e) {
        return { success: false, message: `Błąd: ${e.message}` };
    }
}

/**
 * equip_item — Załóż przedmiot lub weź do ręki
 * @param {object} params
 * @param {string} params.item_name
 * @param {string} [params.slot] - "hand" | "head" | "torso" | "legs" | "feet" (domyślnie "hand")
 */
async function equip_item(bot, params) {
    const { item_name, slot = 'hand' } = params;
    logToGUI('system', `[AKCJA] equip_item: ${item_name} → ${slot}`);

    try {
        const mcData = require('minecraft-data')(bot.version);
        const itemInfo = mcData.itemsByName[item_name];
        if (!itemInfo) return { success: false, message: `Nieznany przedmiot: ${item_name}` };

        const invItem = bot.inventory.items().find(i => i.type === itemInfo.id);
        if (!invItem) return { success: false, message: `Brak ${item_name} w ekwipunku` };

        await bot.equip(invItem, slot);
        return { success: true, message: `Założono ${item_name} w slot ${slot}` };
    } catch (e) {
        return { success: false, message: `Błąd zakładania: ${e.message}` };
    }
}

/**
 * drop_item — Wyrzuć przedmiot z ekwipunku
 * @param {object} params
 * @param {string} params.item_name
 * @param {number} [params.count] - domyślnie cały stack
 */
async function drop_item(bot, params) {
    const { item_name, count } = params;
    logToGUI('system', `[AKCJA] drop_item: ${count || 'wszystkie'} ${item_name}`);

    try {
        const mcData = require('minecraft-data')(bot.version);
        const itemInfo = mcData.itemsByName[item_name] || mcData.blocksByName[item_name];
        if (!itemInfo) return { success: false, message: `Nieznany przedmiot: ${item_name}` };

        const invItem = bot.inventory.items().find(i => i.type === itemInfo.id);
        if (!invItem) return { success: false, message: `Brak ${item_name} w ekwipunku` };

        const dropCount = count || invItem.count;
        await bot.toss(itemInfo.id, null, dropCount);
        return { success: true, message: `Wyrzucono ${dropCount}x ${item_name}` };
    } catch (e) {
        return { success: false, message: `Błąd wyrzucania: ${e.message}` };
    }
}

/**
 * build_structure — Zbuduj gotową strukturę ze schematu JSON
 * @param {object} params
 * @param {string} params.structure_name - np. "small_house"
 */
async function build_structure(bot, params) {
    const { structure_name } = params;
    logToGUI('system', `[AKCJA] build_structure: ${structure_name}`);

    try {
        const { buildStructure } = require('./builder');
        const result = await withTimeout(
            buildStructure(bot, structure_name),
            300000, // 5 minut na budowę
            `budowanie ${structure_name}`
        );
        return result
            ? { success: true, message: `Zbudowano ${structure_name}` }
            : { success: false, message: `Nie udało się zbudować ${structure_name}` };
    } catch (e) {
        return { success: false, message: `Błąd budowania: ${e.message}` };
    }
}

/**
 * sleep — Idź spać (wymaga łóżka)
 * @param {object} params
 */
async function sleep(bot, params) {
    logToGUI('system', '[AKCJA] sleep');

    try {
        const bed = findBlock(bot, 'red_bed', 32) ||
                    findBlock(bot, 'white_bed', 32) ||
                    bot.findBlock({
                        matching: b => b.name.endsWith('_bed'),
                        maxDistance: 32
                    });

        if (!bed) return { success: false, message: 'Brak łóżka w pobliżu' };

        await withTimeout(
            gotoPosition(bot, bed.position.x, bed.position.y, bed.position.z, 2),
            20000, 'idź do łóżka'
        );
        await bot.sleep(bed);
        return { success: true, message: 'Poszedłem spać' };
    } catch (e) {
        return { success: false, message: `Nie mogę spać: ${e.message}` };
    }
}

/**
 * chat — Powiedz coś na czacie
 * @param {object} params
 * @param {string} params.message
 */
async function chat(bot, params) {
    const { message } = params;
    bot.chat(message);
    return { success: true, message: `Powiedziałem: ${message}` };
}

/**
 * wait — Czekaj N sekund (np. na respawn mobów, regenerację)
 * @param {object} params
 * @param {number} params.seconds
 */
async function wait(bot, params) {
    const { seconds = 5 } = params;
    logToGUI('system', `[AKCJA] wait: ${seconds}s`);
    await new Promise(r => setTimeout(r, seconds * 1000));
    return { success: true, message: `Czekałem ${seconds} sekund` };
}


// ═══════════════════════════════════════════════════════════════════════════════
// REJESTR AKCJI — to co AI dostaje do wyboru
// ═══════════════════════════════════════════════════════════════════════════════

const ACTION_REGISTRY = {
    mine_block: {
        fn: mine_block,
        description: 'Wykop N bloków danego typu w pobliżu',
        params: {
            block_type: 'string — nazwa bloku np. iron_ore, oak_log, coal_ore, diamond_ore',
            count: 'number (opcjonalnie) — ile bloków wykopać, domyślnie 1'
        }
    },
    collect_items: {
        fn: collect_items,
        description: 'Podnieś leżące na ziemi przedmioty',
        params: {
            item_name: 'string (opcjonalnie) — filtruj po nazwie, puste = zbierz wszystko',
            max_distance: 'number (opcjonalnie) — zasięg, domyślnie 16'
        }
    },
    goto_position: {
        fn: goto_position,
        description: 'Idź do podanych współrzędnych X Y Z',
        params: {
            x: 'number', y: 'number', z: 'number',
            range: 'number (opcjonalnie) — dopuszczalny dystans, domyślnie 2'
        }
    },
    goto_block: {
        fn: goto_block,
        description: 'Podejdź do najbliższego bloku danego typu',
        params: {
            block_type: 'string — np. crafting_table, furnace, chest',
            max_distance: 'number (opcjonalnie) — domyślnie 64'
        }
    },
    craft_item: {
        fn: craft_item,
        description: 'Skraftuj przedmiot (automatycznie szuka crafting table jeśli potrzebny)',
        params: {
            item_name: 'string — np. wooden_pickaxe, crafting_table, torch',
            count: 'number (opcjonalnie) — domyślnie 1'
        }
    },
    place_block: {
        fn: place_block,
        description: 'Postaw blok z ekwipunku obok siebie',
        params: {
            item_name: 'string — np. furnace, crafting_table',
            dx: 'number (opcjonalnie) — offset X od bota, domyślnie 2',
            dy: 'number (opcjonalnie) — offset Y od bota, domyślnie 0',
            dz: 'number (opcjonalnie) — offset Z od bota, domyślnie 0'
        }
    },
    smelt_items: {
        fn: smelt_items,
        description: 'Przetop przedmioty w piecu (automatycznie stawia piec jeśli go ma)',
        params: {
            input_item: 'string — np. raw_iron, raw_gold, oak_log',
            fuel_item: 'string (opcjonalnie) — domyślnie coal',
            count: 'number (opcjonalnie) — domyślnie 1'
        }
    },
    eat_food: {
        fn: eat_food,
        description: 'Zjedz jedzenie z ekwipunku',
        params: {
            food_item: 'string (opcjonalnie) — konkretny food; puste = wybierze najlepsze z eq'
        }
    },
    attack_entity: {
        fn: attack_entity,
        description: 'Zaatakuj i zabij moba lub gracza w pobliżu',
        params: {
            entity_name: 'string (opcjonalnie) — np. zombie, pig, skeleton; puste = najbliższy hostile',
            max_distance: 'number (opcjonalnie) — domyślnie 16'
        }
    },
    flee_from_entity: {
        fn: flee_from_entity,
        description: 'Uciekaj od groźnego moba',
        params: {
            entity_name: 'string (opcjonalnie) — puste = ucieka od najbliższego hostile',
            distance: 'number (opcjonalnie) — na ile bloków uciec, domyślnie 20'
        }
    },
    explore: {
        fn: explore,
        description: 'Eksploruj w podanym kierunku',
        params: {
            direction: 'string (opcjonalnie) — north | south | east | west | random',
            distance: 'number (opcjonalnie) — domyślnie 50'
        }
    },
    look_around: {
        fn: look_around,
        description: 'Rozejrzyj się — zwraca co ciekawego jest w pobliżu (bloki, byty)',
        params: {
            max_distance: 'number (opcjonalnie) — domyślnie 32'
        }
    },
    equip_item: {
        fn: equip_item,
        description: 'Załóż przedmiot lub weź do ręki',
        params: {
            item_name: 'string — nazwa przedmiotu',
            slot: 'string (opcjonalnie) — hand | head | torso | legs | feet, domyślnie hand'
        }
    },
    drop_item: {
        fn: drop_item,
        description: 'Wyrzuć przedmiot z ekwipunku',
        params: {
            item_name: 'string',
            count: 'number (opcjonalnie) — domyślnie cały stack'
        }
    },
    build_structure: {
        fn: build_structure,
        description: 'Zbuduj gotową strukturę z pliku JSON (np. small_house)',
        params: {
            structure_name: 'string — nazwa struktury np. small_house'
        }
    },
    sleep: {
        fn: sleep,
        description: 'Idź spać do łóżka w pobliżu (pomija noc)',
        params: {}
    },
    chat: {
        fn: chat,
        description: 'Powiedz coś na czacie serwera',
        params: {
            message: 'string — wiadomość do wysłania'
        }
    },
    wait: {
        fn: wait,
        description: 'Czekaj N sekund nie robiąc nic',
        params: {
            seconds: 'number (opcjonalnie) — domyślnie 5'
        }
    },
};

/**
 * Zwraca listę akcji w formacie gotowym do wstrzyknięcia w prompt dla Gemini.
 */
function getActionsPromptBlock() {
    const lines = Object.entries(ACTION_REGISTRY).map(([name, def]) => {
        const paramsStr = Object.entries(def.params)
            .map(([k, v]) => `    ${k}: ${v}`)
            .join('\n');
        return `• ${name}: ${def.description}\n${paramsStr}`;
    });
    return lines.join('\n\n');
}

/**
 * Wykonuje akcję po nazwie z podanymi parametrami.
 * @param {object} bot
 * @param {string} actionName
 * @param {object} params
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function executeAction(bot, actionName, params) {
    const action = ACTION_REGISTRY[actionName];
    if (!action) {
        return { success: false, message: `Nieznana akcja: ${actionName}` };
    }
    return await action.fn(bot, params || {});
}

module.exports = {
    ACTION_REGISTRY,
    getActionsPromptBlock,
    executeAction,
    // eksport helperów dla ewentualnych testów
    findBlock,
    countInInventory,
};
