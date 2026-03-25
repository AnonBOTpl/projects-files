const loguj = require('./logger');

module.exports = function(bot) {
    const DEBUG_CRAFTING = (() => {
        const v = process.env.DEBUG_CRAFTING;
        if (!v) return false;
        return String(v).toLowerCase() === '1' || String(v).toLowerCase() === 'true';
    })();

    function dbg(label, payload) {
        if (!DEBUG_CRAFTING) return;
        if (payload === undefined) return loguj(`[CRAFTDBG] ${label}`);
        try {
            return loguj(`[CRAFTDBG] ${label} ${JSON.stringify(payload)}`);
        } catch (e) {
            return loguj(`[CRAFTDBG] ${label} [unserializable payload]`);
        }
    }

    if (DEBUG_CRAFTING) loguj('[CRAFTDBG] DEBUG_CRAFTING enabled');

    bot.rejestrujKomende({ uzycie: 'craftuj <ilosc> <przedmiot>', opis: 'Tworzy wirtualnie przedmiot (np. craftuj 1 chest)' });
    bot.rejestrujKomende({ uzycie: 'craftuj <przedmiot>', opis: 'Tworzy wirtualnie 1 przedmiot (np. craftuj chest)' });


    async function ulozSiatke(okno, recipe) {
        // Okno craftingu 3x3 z EssentialsX (/craft) ma sloty:
        // 0: wynik (output)
        // 1-9: siatka (1,2,3 - pierwszy rząd, 4,5,6 - drugi, 7,8,9 - trzeci)

        let slotKlucz = 1;

        function skladnikJestPusty(skladnik) {
            if (!skladnik) return true;
            if (Array.isArray(skladnik)) {
                // Jeśli to "lista opcji", puste pole oznacza zwykle brak realnych id > 0
                const ids = skladnik.map(s => (s && typeof s === 'object' ? (s.id ?? null) : s?.id ?? s)).filter(v => v !== null && v !== undefined);
                if (ids.length === 0) return true;
                return ids.every(id => typeof id === 'number' && id <= 0);
            }
            if (typeof skladnik === 'object') {
                if (typeof skladnik.id === 'number') return skladnik.id <= 0;
            }
            if (typeof skladnik === 'number') return skladnik <= 0;
            return false;
        }

        function znajdzPrzedmiotDlaSkadnika(skladnik) {
            if (!skladnik) return null;
            let options = [];
            if (Array.isArray(skladnik)) {
                options = skladnik.map(s => s?.id ?? s).filter(id => id > 0);
            } else {
                const id = skladnik?.id ?? skladnik;
                if (id > 0) options.push(id);
            }
            if (options.length === 0) return null;


            for (const optId of options) {
                const item = okno.items().find(i => i.type === optId && i.slot >= 10);
                if (item) return item;
            }

            // Fallback generic
            const reqName = bot.registry.items[options[0]]?.name;
            if (reqName) {
                if (reqName.endsWith('_planks')) {
                    const anyPlank = okno.items().find(i => i.name.endsWith('_planks') && i.slot >= 10);
                    if (anyPlank) return anyPlank;
                }
                if (reqName.endsWith('_log') || reqName.endsWith('_wood')) {
                    const anyLog = okno.items().find(i => (i.name.endsWith('_log') || i.name.endsWith('_wood')) && i.slot >= 10);
                    if (anyLog) return anyLog;
                }
                if (reqName.endsWith('_coal')) {
                    const anyCoal = okno.items().find(i => (i.name === 'coal' || i.name === 'charcoal') && i.slot >= 10);
                    if (anyCoal) return anyCoal;
                }
            }
            return null;

        }

        if (recipe.inShape) {
            for (let rzedy = 0; rzedy < recipe.inShape.length; rzedy++) {
                const rzad = recipe.inShape[rzedy];
                for (let kolumny = 0; kolumny < rzad.length; kolumny++) {
                    const skladnik = rzad[kolumny];
                    const item = znajdzPrzedmiotDlaSkadnika(skladnik);
                    if (item) {
                        if (DEBUG_CRAFTING) {
                            const reqName = bot.registry.items[item.type]?.name;
                            dbg('ulozSiatke place ingredient', {
                                targetName: recipe?.result ? bot.registry.items[recipe.result.id]?.name : null,
                                slotKlucz,
                                rzedy,
                                kolumny,
                                skladnikPreview: skladnik,
                                chosenItem: { type: item.type, name: reqName, slot: item.slot, count: item.count }
                            });
                        }
                        await bot.clickWindow(item.slot, 0, 0);
                        await new Promise(r => setTimeout(r, 100));
                        await bot.clickWindow(slotKlucz, 1, 0);
                        await new Promise(r => setTimeout(r, 100));
                        if (okno.selectedItem) {
                            await bot.clickWindow(item.slot, 0, 0);
                            await new Promise(r => setTimeout(r, 100));
                        }
                    } else if (skladnik && (!Array.isArray(skladnik) || skladnik.length > 0)) {
                        // Mineflayer dla "pustych" miejsc w inShape potrafi zwracać { id: -1 }.
                        // Te pola mamy po prostu zostawić puste.
                        if (skladnikJestPusty(skladnik)) {
                            dbg('ulozSiatke skip empty slot', { slotKlucz, rzedy, kolumny, skladnikPreview: skladnik });
                        } else {
                        dbg('ulozSiatke missing ingredient', {
                            targetName: recipe?.result ? bot.registry.items[recipe.result.id]?.name : null,
                            slotKlucz,
                            rzedy,
                            kolumny,
                            skladnikType: Array.isArray(skladnik) ? 'array' : typeof skladnik,
                            skladnikPreview: skladnik,
                            windowInvPreview: okno.items()
                                .filter(i => i.slot >= 10)
                                .slice(0, 20)
                                .map(i => ({ slot: i.slot, type: i.type, name: bot.registry.items[i.type]?.name, count: i.count }))
                        });
                        throw new Error('Brak składnika w ekwipunku dla craftingu!');
                        }
                    }
                    slotKlucz++;
                }
                slotKlucz += (3 - rzad.length);
            }
        } else if (recipe.ingredients) {
            for (let i = 0; i < recipe.ingredients.length; i++) {
                const skladnik = recipe.ingredients[i];
                const item = znajdzPrzedmiotDlaSkadnika(skladnik);
                if (item) {
                        if (DEBUG_CRAFTING) {
                            const reqName = bot.registry.items[item.type]?.name;
                            dbg('ulozSiatke place ingredient', {
                                targetName: recipe?.result ? bot.registry.items[recipe.result.id]?.name : null,
                                slotKlucz,
                                gridIndex: i,
                                skladnikPreview: skladnik,
                                chosenItem: { type: item.type, name: reqName, slot: item.slot, count: item.count }
                            });
                        }
                    await bot.clickWindow(item.slot, 0, 0);
                    await new Promise(r => setTimeout(r, 100));
                    await bot.clickWindow(slotKlucz, 1, 0);
                    await new Promise(r => setTimeout(r, 100));
                    if (okno.selectedItem) {
                        await bot.clickWindow(item.slot, 0, 0);
                        await new Promise(r => setTimeout(r, 100));
                    }
                } else if (skladnik && (!Array.isArray(skladnik) || skladnik.length > 0)) {
                    if (skladnikJestPusty(skladnik)) {
                        dbg('ulozSiatke skip empty slot', { slotKlucz, gridIndex: i, skladnikPreview: skladnik });
                    } else {
                    dbg('ulozSiatke missing ingredient', {
                        targetName: recipe?.result ? bot.registry.items[recipe.result.id]?.name : null,
                        slotKlucz,
                        gridIndex: i,
                        skladnikType: Array.isArray(skladnik) ? 'array' : typeof skladnik,
                        skladnikPreview: skladnik,
                        windowInvPreview: okno.items()
                            .filter(ii => ii.slot >= 10)
                            .slice(0, 20)
                            .map(ii => ({ slot: ii.slot, type: ii.type, name: bot.registry.items[ii.type]?.name, count: ii.count }))
                    });
                    throw new Error('Brak składnika w ekwipunku dla craftingu!');
                    }
                }
                slotKlucz++;
            }
        }
    }



    async function skompletujSkladniki(recipe, iloscRekursji = 1, depth = 0) {
        let braki = [];
        let podliczono = {};

        const targetName =
            recipe?.result?.id ? bot.registry.items[recipe.result.id]?.name : null;
        dbg('skompletujSkladniki start', { targetName, iloscRekursji, depth });

        function sprawdz(skladnik) {
            if (!skladnik) return;
            // skladnik can be a single ID, an object {id}, or an array of acceptable ids/objects
            let options = [];
            if (Array.isArray(skladnik)) {
                options = skladnik.map(s => s?.id ?? s).filter(id => id > 0);
            } else {
                const id = skladnik?.id ?? skladnik;
                if (id > 0) options.push(id);
            }
            if (options.length === 0) return;

            // Do we have any of these options in inventory to fulfill this ONE slot?
            // Actually, podliczono tracks total required. We should pick ONE option that we either have or can craft.
            // Let's see if we already have one of the options in inventory
            let bestOption = options[0];
            let maxCount = -1;
            for (const optId of options) {
                const count = bot.inventory.items().filter(i => i.type === optId).reduce((acc, i) => acc + i.count, 0);
                if (count > maxCount) {
                    maxCount = count;
                    bestOption = optId;
                }
            }

            // Just use bestOption as the required item
            podliczono[bestOption] = (podliczono[bestOption] || 0) + iloscRekursji;
        }

        if (recipe.inShape) {
            for (const rzad of recipe.inShape) {
                for (const skladnik of rzad) sprawdz(skladnik);
            }
        } else if (recipe.ingredients) {
            for (const skladnik of recipe.ingredients) sprawdz(skladnik);
        }

        // Debug: co bot faktycznie uznał za wymagane składniki
        if (DEBUG_CRAFTING) {
            const pod = Object.entries(podliczono).map(([idStr, count]) => {
                const id = parseInt(idStr);
                return {
                    id,
                    name: bot.registry.items[id]?.name,
                    count
                };
            });
            dbg('podliczono computed', { targetName, iloscRekursji, depth, pod });
            dbg('inventory snapshot (relevant types)', {
                targetName,
                depth,
                inv: pod.map(p => ({
                    name: p.name,
                    id: p.id,
                    count: bot.inventory.items().filter(i => i.type === p.id).reduce((acc, i) => acc + i.count, 0)
                }))
            });
        }

        for (const [idStr, ileTrzeba] of Object.entries(podliczono)) {
            const id = parseInt(idStr);
            const wEq = bot.inventory.items().filter(i => i.type === id).reduce((acc, i) => acc + i.count, 0);

            let actualEq = wEq;
            const nazwaBraku = bot.registry.items[id]?.name;
            if (nazwaBraku) {
                if (nazwaBraku.endsWith('_planks')) {
                    actualEq = bot.inventory.items().filter(i => i.name.endsWith('_planks')).reduce((acc, i) => acc + i.count, 0);
                } else if (nazwaBraku.endsWith('_log') || nazwaBraku.endsWith('_wood')) {
                    actualEq = bot.inventory.items().filter(i => i.name.endsWith('_log') || i.name.endsWith('_wood')).reduce((acc, i) => acc + i.count, 0);
                } else if (nazwaBraku.endsWith('_coal')) {
                    actualEq = bot.inventory.items().filter(i => i.name === 'coal' || i.name === 'charcoal').reduce((acc, i) => acc + i.count, 0);
                }
            }

            if (actualEq < ileTrzeba) {
                braki.push({ nazwa: nazwaBraku, brakuje: ileTrzeba - actualEq });
            }

        }

        dbg('initial missing computed', { targetName, braki, depth });

        // Spróbuj stworzyć/przepalić braki
        for (const brak of braki) {
            if (!brak.nazwa) continue;

            dbg('craft half (initial)', { targetName, brak, depth });

            // Jesli to sztabki i można przepalić rudy
            if (brak.nazwa.endsWith('_ingot')) {
                const rawName = 'raw_' + brak.nazwa.replace('_ingot', '');
                const oreName = brak.nazwa.replace('_ingot', '_ore');

                const rawItem = bot.inventory.items().find(i => i.name === rawName);
                if (rawItem && rawItem.count >= brak.brakuje && bot.wirtualniePrzepal) {
                    await bot.wirtualniePrzepal(rawName, brak.brakuje);
                    continue;
                }

                const oreItem = bot.inventory.items().find(i => i.name === oreName);
                if (oreItem && oreItem.count >= brak.brakuje && bot.wirtualniePrzepal) {
                    await bot.wirtualniePrzepal(oreName, brak.brakuje);
                    continue;
                }
            }

            // Jeśli próbujemy scraftować deski (planks) a nie mamy dębu, poszukaj jakichkolwiek pni
            let nazwaDoCraftu = brak.nazwa;
            if (brak.nazwa.endsWith('_planks')) {
                const jakikolwiekPien = bot.inventory.items().find(i => i.name.endsWith('_log') || i.name.endsWith('_wood'));
                if (jakikolwiekPien) {
                    nazwaDoCraftu = jakikolwiekPien.name.replace('_log', '_planks').replace('_wood', '_planks');
                }
            }

            if (depth < 3) {
                const success = await bot.wirtualnieCraftuj(nazwaDoCraftu, brak.brakuje, depth + 1);
                if (!success) throw new Error(`Nie udało się scraftować półproduktu: ${nazwaDoCraftu}`);
            }
        }

        // Auto-uzupełnienie: po zrobieniu kilku półproduktów ich ilości mogą się zmienić
        // (np. patyki zużywają deski). Re-policz braki i dobierz to, czego faktycznie dalej brakuje.
        const MAX_DODATKOWE_UZUPELNIENIA = 5;
        function computeBrakiPoCraftach() {
            const localBraki = [];
            for (const [idStr, ileTrzeba] of Object.entries(podliczono)) {
                const id = parseInt(idStr);
                const wEq = bot.inventory.items().filter(i => i.type === id).reduce((acc, i) => acc + i.count, 0);

                let actualEq = wEq;
                const nazwaBraku = bot.registry.items[id]?.name;
                if (nazwaBraku) {
                    if (nazwaBraku.endsWith('_planks')) {
                        actualEq = bot.inventory.items().filter(i => i.name.endsWith('_planks')).reduce((acc, i) => acc + i.count, 0);
                    } else if (nazwaBraku.endsWith('_log') || nazwaBraku.endsWith('_wood')) {
                        actualEq = bot.inventory.items().filter(i => i.name.endsWith('_log') || i.name.endsWith('_wood')).reduce((acc, i) => acc + i.count, 0);
                    } else if (nazwaBraku.endsWith('_coal')) {
                        actualEq = bot.inventory.items().filter(i => i.name === 'coal' || i.name === 'charcoal').reduce((acc, i) => acc + i.count, 0);
                    }
                }

                if (actualEq < ileTrzeba) {
                    localBraki.push({ nazwa: nazwaBraku, brakuje: ileTrzeba - actualEq });
                }
            }
            return localBraki;
        }

        for (let pass = 0; pass < MAX_DODATKOWE_UZUPELNIENIA; pass++) {
            const brakiAktualne = computeBrakiPoCraftach();
            if (brakiAktualne.length === 0) return;

            if (depth >= 3) break;

            brakiAktualne.sort((a, b) => b.brakuje - a.brakuje);
            const brak = brakiAktualne[0];
            if (!brak?.nazwa) continue;
            dbg('craft half (recalc pass)', { pass, targetName, brak, depth });

            if (brak.nazwa.endsWith('_ingot') && bot.wirtualniePrzepal) {
                const rawName = 'raw_' + brak.nazwa.replace('_ingot', '');
                const oreName = brak.nazwa.replace('_ingot', '_ore');

                const rawItem = bot.inventory.items().find(i => i.name === rawName);
                if (rawItem && rawItem.count >= brak.brakuje) {
                    await bot.wirtualniePrzepal(rawName, brak.brakuje);
                    continue;
                }

                const oreItem = bot.inventory.items().find(i => i.name === oreName);
                if (oreItem && oreItem.count >= brak.brakuje) {
                    await bot.wirtualniePrzepal(oreName, brak.brakuje);
                    continue;
                }
            }

            let nazwaDoCraftu = brak.nazwa;
            if (brak.nazwa.endsWith('_planks')) {
                const jakikolwiekPien = bot.inventory.items().find(i => i.name.endsWith('_log') || i.name.endsWith('_wood'));
                if (!jakikolwiekPien) break;
                nazwaDoCraftu = jakikolwiekPien.name.replace('_log', '_planks').replace('_wood', '_planks');
            }

            const success = await bot.wirtualnieCraftuj(nazwaDoCraftu, brak.brakuje, depth + 1);
            if (!success) throw new Error(`Nie udało się scraftować brakującego półproduktu: ${nazwaDoCraftu}`);
        }

        // Ostateczne sprawdzenie — jeśli nadal brakuje, to kończymy błędem,
        // bo finalny /craft i tak nie przejdzie walidacji w `wirtualnieCraftuj`.
        const brakiNaKoniec = computeBrakiPoCraftach();
        if (brakiNaKoniec.length > 0) {
            dbg('skompletujSkladniki final missing', { targetName, brakiNaKoniec, depth });
            throw new Error('Nie udało się uzupełnić składników do craftingu: ' + brakiNaKoniec.map(b => `${b.nazwa}(-${b.brakuje})`).join(', '));
        }
    }

    bot.wirtualnieCraftuj = async function(nazwaPrzedmiotu, ilosc = 1, depth = 0) {

        try {
            const itemType = bot.registry.itemsByName[nazwaPrzedmiotu];
            if (!itemType) {
                dbg('wirtualnieCraftuj unknown item', { nazwaPrzedmiotu });
                bot.chat(`Nie znam przedmiotu: ${nazwaPrzedmiotu}`);
                return;
            }

            dbg('wirtualnieCraftuj itemType', {
                nazwaPrzedmiotu,
                itemTypeId: itemType.id,
                itemTypeName: itemType.name
            });

            // recipesFor w mineflayerze zwraca tylko przepisy, na które bot ma już
            // bezpośrednie składniki w ekwipunku.
            // My potrzebujemy wszystkich receptur, bo my sami craftujemy brakujące półprodukty.
            const craftingTableId = bot.registry.blocksByName?.['crafting_table']?.id;
            let receptury = [];

            if (craftingTableId) {
                receptury = bot.recipesAll(
                    itemType.id,
                    null,
                    1,
                    { type: craftingTableId }
                );
            }
            if (receptury.length === 0) {
                receptury = bot.recipesAll(itemType.id, null, 1);
            }

            dbg('wirtualnieCraftuj recipesAll count', {
                nazwaPrzedmiotu,
                itemTypeId: itemType.id,
                craftingTableId,
                recepturyCount: receptury.length
            });

            if (receptury.length === 0) {
                bot.chat(`Nie potrafię stworzyć ${nazwaPrzedmiotu} (brak receptury).`);
                return;
            }

            // Wybieramy pierwszą dostępną recepturę
            const recipe = receptury[0];
            const yieldCount = recipe.result?.count || 1;
            // Calculate how many times we actually need to craft it to reach `ilosc`.
            // Wait, if `ilosc` was passed by user as 10, does it mean 10 times or 10 items? Usually items.
            // Let's say `ilosc` is the target total amount of items we want.
            const timesToCraft = Math.ceil(ilosc / yieldCount);

            bot.chat(`Rozpoczynam wirtualny crafting: ${nazwaPrzedmiotu} (x${ilosc}).`);
            dbg('wirtualnieCraftuj start', { nazwaPrzedmiotu, ilosc, depth, timesToCraft, yieldCount });
            await skompletujSkladniki(recipe, timesToCraft, depth);

            for(let wykonanie = 0; wykonanie < timesToCraft; wykonanie++) {
                if (bot.currentWindow) bot.closeWindow(bot.currentWindow);
                await new Promise(r => setTimeout(r, 200));

                // Otwórz wirtualny stół z EssentialsX
                bot.chat('/craft');

                // Czekamy na załadowanie okna craftingu
                const okno = await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error("Timeout otwierania okna /craft")), 5000);
                    bot.once('windowOpen', (win) => {
                        clearTimeout(timeout);
                        resolve(win);
                    });
                });

                if (!okno.slots || okno.slots.length < 10) {
                    bot.closeWindow(okno);
                    throw new Error("Otwarto nieprawidłowe okno (" + okno.type + ")");
                }

                await new Promise(r => setTimeout(r, 300)); // mały delay by serwer zarejestrował okno

                // Układanie składników w oknie 1-9
                await ulozSiatke(okno, recipe);

                // Odczekanie by serwer rozpoznał gotową recepturę w polu output(0)
                await new Promise(r => setTimeout(r, 200));

                const outputItem = okno.slots[0];
                if (!outputItem || outputItem.type !== itemType.id) {
                    dbg('craft output mismatch', {
                        nazwaPrzedmiotu,
                        depth,
                        expectedType: itemType.id,
                        got: outputItem ? { type: outputItem.type, name: bot.registry.items[outputItem.type]?.name, count: outputItem.count } : null
                    });
                    bot.closeWindow(okno);
                    throw new Error("Serwer nie zatwierdził craftingu w slocie wynikowym (brak itemu). Upewnij się, że masz składniki.");
                }

                // Ściągnij zrobiony przedmiot (Shift + Click na slot 0 wyrzuci go do ekwipunku)
                await bot.clickWindow(0, 0, 1);

                // Opóźnione oczekiwanie na pojawienie się w eq (maks. 3 sekundy)
                await new Promise((resolve) => {
                    let attempts = 0;
                    const inter = setInterval(() => {
                        if (bot.inventory.items().find(i => i.type === itemType.id) || attempts > 30) {
                            clearInterval(inter);
                            resolve();
                        }
                        attempts++;
                    }, 100);
                });

                bot.closeWindow(okno);
                await new Promise(r => setTimeout(r, 500)); // przerwa przed następnym craftem, żeby EssentialsX się nie zablokował komendami
            }

            bot.chat(`Gotowe! Skonstruowałem ${ilosc}x ${nazwaPrzedmiotu}.`);

        } catch (error) {
            loguj(`Błąd wirtualnego craftingu: ${error.message}`);
            if (DEBUG_CRAFTING) {
                loguj(`[CRAFTDBG] stack ${error?.stack ? error.stack : String(error)}`);
            }
            bot.chat(`Nie udało się wytworzyć przedmiotu: ${error.message}`);
            return false;
        }
        return true;
    }

    bot.on('komenda', async (username, message) => {
        if (username === bot.username) return;
        if (!bot.czyUpowazniony(username)) return;

        if (message.startsWith('craftuj ')) {
            const args = message.split(' ').slice(1);
            if (args.length === 0) return bot.chat('Podaj co mam scraftować!');

            let ilosc = 1;
            let nazwaPrzedmiotu = args[0];

            if (args.length > 1 && !isNaN(parseInt(args[0]))) {
                ilosc = parseInt(args[0]);
                nazwaPrzedmiotu = args[1];
            }

            dbg('command craftuj', { username, ilosc, nazwaPrzedmiotu });
            await bot.wirtualnieCraftuj(nazwaPrzedmiotu, ilosc);
        }
    });
};