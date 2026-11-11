# Zdaj PJA

Pytania, materiały, fiszki i powtórki ze wszystkich przedmiotów PJATK. Strona statyczna na GitHub Pages, po polsku i angielsku, z jasnym i ciemnym motywem.

> Projekt powstał na bazie [zdaj.se](https://pjatk.zdaj.se) ([zdaj-se-pjatk](https://github.com/bibixx/zdaj-se-pjatk)) autorstwa [bibixx](https://github.com/bibixx). Korzysta z jego danych i jest połączony z [PPJ-Quiz](https://github.com/PixelFpv/PPJ-Quiz).

## Tryby nauki

Powtórki (jak w Anki), fiszki, ucz się, test, pisanie, dopasowanie, prawda/fałsz oraz pytania otwarte, czyli pytania bez klucza odpowiedzi. Każdy tryb można zawęzić do całego przedmiotu, kolokwiów lub egzaminu.

## Przedmioty

Układ semestrów, kody i nazwy pochodzą z [programu studiów Informatyka I stopnia 2025/26](https://pja.edu.pl/wp-content/uploads/2025/07/Informatyka_stacjonarne_pierwszy_2025_PL.pdf) i są zapisane w `scripts/program.mjs`. Stare kody folderów (np. AM1, SKO1) są tam mapowane na kody z programu.

## Pytania z materiałów

`content/mined/<przedmiot>.json` zawiera pytania wyciągnięte automatycznie z dokumentów i skanów (OCR). Nie mają klucza, nie były sprawdzane i mogą zawierać błędy odczytu, dlatego trafiają tylko do trybu pytań otwartych. Pytania sprawdzone ręcznie są w `content/questions`.

## Uruchomienie

```
npm install
npm run sync   # pobiera dane do public/data
npm run dev
```

`npm test` uruchamia testy, a `npm run build` buduje stronę do `dist/`.

## Wdrożenie na GitHub Pages

1. Wypchnij repozytorium na GitHuba.
2. W **Settings → Pages** ustaw **Source: GitHub Actions**.

Workflow `deploy.yml` buduje stronę po każdym pushu i codziennie, więc nowe pytania z zdaj-se i PPJ-Quiz pojawiają się same. Żeby dodać własną domenę, utwórz `public/CNAME`.

## Dodawanie pytań

Na stronie: **Dodaj pytania**. Pytania działają od razu w tej przeglądarce, a przycisk **Opublikuj dla wszystkich** tworzy zgłoszenie na GitHubie. Zgłoszenia właściciela i współpracowników są dodawane automatycznie, a pozostałe po nadaniu etykiety `approved`. Trafiają do `content/questions/<przedmiot>.json`.

Małe zestawy trafiają do zgłoszenia bezpośrednio. Większe (np. 200 pytań) nie zmieszczą się w linku, więc strona pobiera plik `pytania-<przedmiot>.json`, który przeciąga się do zgłoszenia. Automat odczytuje pytania z tego pliku, do 500 pytań i 2 MB na zgłoszenie.

Pytania można też dopisać do tych plików ręcznie:

```json
{
  "courseId": "ppj",
  "questions": [
    {
      "id": "unikalny-identyfikator",
      "q": "Treść w Markdownie",
      "f": "md",
      "scope": "exam",
      "a": [{ "t": "Odpowiedź", "c": true, "f": "md" }, { "t": "Inna", "c": false, "f": "md" }]
    }
  ]
}
```

`scope` przyjmuje `all`, `colloquium` lub `exam`. Fiszka zamiast `a` ma pole `back` i pustą listę `a`.

## Dodawanie i zatwierdzanie materiałów

Na stronie: **Dodaj materiały**. Formularz otwiera zgłoszenie na GitHubie, do którego przeciąga się pliki. Pliki właściciela i współpracowników trafiają na stronę automatycznie. Cudze zgłoszenia czekają: otwórz plik w zgłoszeniu i nadaj etykietę `approved`, żeby go przyjąć, albo zamknij zgłoszenie, żeby odrzucić.

Pliki są w `content/materials/<przedmiot>/<rodzaj>/`, gdzie rodzaj to `exam`, `colloquium`, `lecture`, `lab` lub `other`. Można je też dodać zwykłym commitem.

## Statystyki

Google Analytics (kontener `GTM-NBS4DT4J`) ładuje się dopiero po zgodzie użytkownika, z kodu w `src/lib/analytics.ts`. Nie wklejaj skryptu GTM do `index.html`, bo działałby bez zgody. Automatyczne odsłony kontenera są wyłączone, a strona wysyła własne `page_view` z prawdziwą ścieżką, np. `/zdaj-pja/c/sbd`.

## Skąd są dane

| Dane | Źródło | Licencja |
| --- | --- | --- |
| Bazy pytań i materiały | [zdaj-se-pjatk-data](https://github.com/bibixx/zdaj-se-pjatk-data), [zdaj-se-pjatk-files](https://github.com/bibixx/zdaj-se-pjatk-files) | CC BY-SA 4.0, zmieniony format i scalone poprawki |
| Pytania z PPJ | [PPJ-Quiz](https://github.com/PixelFpv/PPJ-Quiz) | |
| Pierwowzór strony | [zdaj-se-pjatk](https://github.com/bibixx/zdaj-se-pjatk) | Beerware, © bibixx |

Treści dodawane do `content/questions` są udostępniane na CC BY-SA 4.0.

## Licencja

Kod jest na licencji [MIT](./LICENSE). Dane zachowują swoje licencje, w tym CC BY-SA 4.0. Szczegóły i pełne teksty są w katalogu [`LICENSES`](./LICENSES/README.md).
