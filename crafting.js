const loguj = require('./logger');

module.exports = function(bot) {

    bot.rejestrujKomende({ uzycie: 'craftuj <ilosc> <przedmiot>', opis: 'Tworzy wirtualnie przedmiot (np. craftuj 1 chest)' });
    bot.rejestrujKomende({ uzycie: 'craftuj <przedmiot>', opis: 'Tworzy wirtualnie 1 przedmiot (np. craftuj chest)' });

    async function ulozSiatke(okno, recipe) {
        // Okno craftingu 3x3 z EssentialsX (/craft) ma sloty:
        // 0: wynik (output)
        // 1-9: siatka (1,2,3 - pierwszy rząd, 4,5,6 - drugi, 7,8,9 - trzeci)

        let slotKlucz = 1;

        if (recipe.inShape) {
            // Receptury ułożone (np. skrzynia, miecz, kilof)
            for (let rzedy = 0; rzedy < recipe.inShape.length; rzedy++) {
                const rzad = recipe.inShape[rzedy];
                for (let kolumny = 0; kolumny < rzad.length; kolumny++) {
                    const skladnik = rzad[kolumny];
                    // składnik może być obiektem {id, metadata} lub liczbą
                    const idSkladnika = skladnik?.id ?? skladnik;
                    if (idSkladnika && idSkladnika > 0) {
                        const item = okno.items().find(i => i.type === idSkladnika && i.slot >= 10);
                        if (!item) throw new Error(`Brak składnika: ${idSkladnika}`);

                        // Zawsze dodajemy tylko JEDNĄ sztukę dla danego pola, by stworzyć 1 sztukę receptury
                        await bot.clickWindow(item.slot, 0, 0); // kliknij lewym na przedmiot w eq
                        await new Promise(r => setTimeout(r, 100));
                        await bot.clickWindow(slotKlucz, 1, 0); // kliknij prawym (1 item) na odpowiednie pole siatki
                        await new Promise(r => setTimeout(r, 100));
                        if (okno.selectedItem) {
                            // Odkładamy resztę stosu na to samo miejsce skąd wzięliśmy, jeśli coś jeszcze trzymamy
                            await bot.clickWindow(item.slot, 0, 0);
                            await new Promise(r => setTimeout(r, 100));
                        }
                    }
                    slotKlucz++;
                }
                // Dopełniamy do 3 kolumn jeśli receptura jest np. 2x2 wewnątrz siatki 3x3
                slotKlucz += (3 - rzad.length);
            }
        } else if (recipe.ingredients) {
            // Receptury bezkształtne
            for (let i = 0; i < recipe.ingredients.length; i++) {
                const skladnik = recipe.ingredients[i];
                const idSkladnika = skladnik?.id ?? skladnik;
                if (idSkladnika && idSkladnika > 0) {
                    const item = okno.items().find(it => it.type === idSkladnika && it.slot >= 10);
                    if (!item) throw new Error(`Brak składnika: ${idSkladnika}`);

                    await bot.clickWindow(item.slot, 0, 0);
                    await new Promise(r => setTimeout(r, 100));
                    await bot.clickWindow(slotKlucz, 1, 0);
                    await new Promise(r => setTimeout(r, 100));
                    if (okno.selectedItem) {
                        await bot.clickWindow(item.slot, 0, 0);
                        await new Promise(r => setTimeout(r, 100));
                    }
                }
                slotKlucz++;
            }
        }
    }

    async function wytworzPrzezVirtualnyStol(nazwaPrzedmiotu, ilosc) {
        if (!bot.ustawPrace('CRAFTOWANIE')) return bot.chat('Chwila, kończę zmianę trybu...');

        try {
            const itemType = bot.registry.itemsByName[nazwaPrzedmiotu];
            if (!itemType) {
                bot.chat(`Nie znam przedmiotu: ${nazwaPrzedmiotu}`);
                return;
            }

            // Podajemy true jako stół rzemieślniczy, by Mineflayer znalazł receptury 3x3
            const receptury = bot.recipesFor(itemType.id, null, 1, true);
            if (receptury.length === 0) {
                bot.chat(`Nie potrafię stworzyć ${nazwaPrzedmiotu} (brak receptury).`);
                return;
            }

            // Wybieramy pierwszą dostępną recepturę
            const recipe = receptury[0];

            bot.chat(`Rozpoczynam wirtualny crafting: ${nazwaPrzedmiotu} (x${ilosc}).`);

            for(let wykonanie = 0; wykonanie < ilosc; wykonanie++) {

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

                if (okno.type !== 'minecraft:crafting') {
                    bot.closeWindow(okno);
                    throw new Error("Otwarto złe okno, oczekiwano minecraft:crafting");
                }

                await new Promise(r => setTimeout(r, 300)); // mały delay by serwer zarejestrował okno

                // Układanie składników w oknie 1-9
                await ulozSiatke(okno, recipe);

                // Odczekanie by serwer rozpoznał gotową recepturę w polu output(0)
                await new Promise(r => setTimeout(r, 200));

                const outputItem = okno.slots[0];
                if (!outputItem || outputItem.type !== itemType.id) {
                    bot.closeWindow(okno);
                    throw new Error("Serwer nie zatwierdził craftingu w slocie wynikowym (brak itemu). Upewnij się, że masz składniki.");
                }

                // Ściągnij zrobiony przedmiot (Shift + Click na slot 0 wyrzuci go do ekwipunku)
                await bot.clickWindow(0, 0, 1);
                await new Promise(r => setTimeout(r, 200));

                bot.closeWindow(okno);
                await new Promise(r => setTimeout(r, 500)); // przerwa przed następnym craftem, żeby EssentialsX się nie zablokował komendami
            }

            bot.chat(`Gotowe! Skonstruowałem ${ilosc}x ${nazwaPrzedmiotu}.`);

        } catch (error) {
            loguj(`Błąd wirtualnego craftingu: ${error.message}`);
            bot.chat(`Nie udało się wytworzyć przedmiotu: ${error.message}`);
        } finally {
            bot.ustawPrace('WOLNY');
        }
    }

    bot.on('chat', async (username, message) => {
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

            await wytworzPrzezVirtualnyStol(nazwaPrzedmiotu, ilosc);
        }
    });
};
