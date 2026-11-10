# Licencje

Projekt powstał na bazie [zdaj.se](https://pjatk.zdaj.se) ([zdaj-se-pjatk](https://github.com/bibixx/zdaj-se-pjatk)) autorstwa [bibixx](https://github.com/bibixx).

| Co | Licencja | Tekst |
| --- | --- | --- |
| Kod tego repozytorium | MIT, © 2026 PixelFpv | [`LICENSE`](../LICENSE) |
| Pierwowzór, zdaj-se-pjatk | Beerware, Revision 42, © bibixx | [`Beerware-zdaj-se-pjatk.md`](./Beerware-zdaj-se-pjatk.md) |
| Bazy pytań, [zdaj-se-pjatk-data](https://github.com/bibixx/zdaj-se-pjatk-data), © bibixx i współtwórcy | CC BY-SA 4.0 | [`CC-BY-SA-4.0.md`](./CC-BY-SA-4.0.md) |
| Spis materiałów, [zdaj-se-pjatk-files](https://github.com/bibixx/zdaj-se-pjatk-files), © bibixx i współtwórcy | CC BY-SA 4.0 | [`CC-BY-SA-4.0.md`](./CC-BY-SA-4.0.md) |
| Pytania w `content/questions` | CC BY-SA 4.0 | [`CC-BY-SA-4.0.md`](./CC-BY-SA-4.0.md) |
| Pytania z [PPJ-Quiz](https://github.com/PixelFpv/PPJ-Quiz) | wykorzystane przez autora projektu | |

Licencja MIT obejmuje tylko kod. Nie obejmuje danych wymienionych powyżej, które zachowują swoje licencje.

## Zmiany w danych

Skrypt `scripts/sync-data.mjs` zmienia format baz pytań, scala oficjalne poprawki z `overrides/patches`, łączy bazy w przedmioty i klasyfikuje materiały według ścieżek. Pliki materiałów nie są kopiowane do tego repozytorium. Strona pobiera je bezpośrednio z GitHuba, gdy użytkownik o to poprosi.

Biblioteki i czcionki z `package.json` mają własne licencje, dostępne w ich pakietach.
