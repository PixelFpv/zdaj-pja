# Zdaj PJA

Pytania, materiały, fiszki i powtórki ze wszystkich przedmiotów PJATK. Strona statyczna na GitHub Pages, po polsku i angielsku, z jasnym i ciemnym motywem.

> Projekt powstał na bazie [zdaj.se](https://pjatk.zdaj.se) ([zdaj-se-pjatk](https://github.com/bibixx/zdaj-se-pjatk)) autorstwa [bibixx](https://github.com/bibixx). Korzysta z jego danych i jest połączony z [PPJ-Quiz](https://github.com/PixelFpv/PPJ-Quiz).

## Tryby nauki

Powtórki (jak w Anki), fiszki, ucz się, test, pisanie, dopasowanie oraz prawda/fałsz. Każdy można zawęzić do całego przedmiotu, kolokwiów lub egzaminu.

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

## Skąd są dane

| Dane | Źródło | Licencja |
| --- | --- | --- |
| Bazy pytań i materiały | [zdaj-se-pjatk-data](https://github.com/bibixx/zdaj-se-pjatk-data), [zdaj-se-pjatk-files](https://github.com/bibixx/zdaj-se-pjatk-files) | CC BY-SA 4.0, zmieniony format i scalone poprawki |
| Pytania z PPJ | [PPJ-Quiz](https://github.com/PixelFpv/PPJ-Quiz) | |
| Pierwowzór strony | [zdaj-se-pjatk](https://github.com/bibixx/zdaj-se-pjatk) | Beerware, © bibixx |

Treści dodawane do `content/questions` są udostępniane na CC BY-SA 4.0.

## Licencja

Kod jest na licencji [MIT](./LICENSE). Dane zachowują swoje licencje, w tym CC BY-SA 4.0. Szczegóły i pełne teksty są w katalogu [`LICENSES`](./LICENSES/README.md).
