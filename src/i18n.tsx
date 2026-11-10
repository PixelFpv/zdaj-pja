import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Lang = 'pl' | 'en';
const KEY = 'zdaj-pja.lang';

const pl = {
  'nav.courses': 'Przedmioty', 'nav.add': 'Dodaj pytania', 'nav.materials': 'Dodaj materiały', 'nav.data': 'Twoje dane',
  'amat.title': 'Dodaj materiały', 'amat.lead': 'Kolokwia, egzaminy i notatki trafią do zakładki Materiały i do generatora fiszek.', 'amat.category': 'Rodzaj materiału', 'amat.open': 'Przejdź do wysyłania plików',
  'amat.step1': 'Na GitHubie przeciągnij pliki do pola tekstowego i poczekaj, aż się wgrają.', 'amat.step2': 'Kliknij „Create” (albo „Submit new issue”).', 'amat.step3': 'Pliki właściciela pojawiają się po kilku minutach, a pozostałe po zatwierdzeniu.',
  'amat.rules': 'Potrzebne jest konto GitHub. Dozwolone pliki: PDF, DOC, DOCX, PPT, PPTX, ODT, RTF, TXT, MD, JPG i PNG, do 25 MB każdy i najwyżej 20 naraz. Pliki są publiczne, więc dodawaj tylko te, które możesz udostępniać.', 'amat.pending': 'Zgłoszenia do zatwierdzenia',
  'amat.issueBody': 'Przeciągnij pliki tutaj i nie zmieniaj bloku powyżej:', 'materials.own': 'dodane tutaj', 'course.addMaterial': 'Dodaj materiał',
  'theme.toLight': 'Włącz jasny motyw', 'theme.toDark': 'Włącz ciemny motyw', 'lang.switch': 'Switch to English',
  'common.loading': 'Ładowanie…', 'common.error': 'Nie udało się wczytać danych. Odśwież stronę.', 'common.back': 'Wróć',
  'common.delete': 'Usuń', 'common.edit': 'Edytuj', 'common.cancel': 'Anuluj', 'common.save': 'Zapisz', 'common.next': 'Dalej', 'common.prev': 'Wstecz',
  'common.check': 'Sprawdź', 'common.again': 'Jeszcze raz', 'common.finish': 'Zakończ', 'common.showMore': 'Pokaż więcej', 'common.search': 'Szukaj',
  'common.correct': 'Dobrze!', 'common.wrong': 'Niestety źle', 'common.noKey': 'Brak klucza odpowiedzi w źródle.', 'common.backToCourse': 'Wróć do przedmiotu',
  'about.based': 'Projekt powstał na bazie {zdaj} ({code}) autorstwa {author}.',
  'footer.credits': 'Pytania i materiały: {data} oraz {files} na licencji {ccby}, ze zmienionym formatem i scalonymi poprawkami. Quiz PPJ: {ppj}. Kod strony: {mit}.',
  'footer.local': 'Postępy zapisują się tylko w tej przeglądarce.',
  'home.title': 'Plan studiów', 'home.lead': 'Informatyka, studia inżynierskie, {program}. Wybierz przedmiot i zacznij się uczyć.', 'home.program': 'program 2025/26', 'home.column': 'Semestr {n}', 'home.elective': 'do wyboru', 'home.archive': 'Poza obecnym programem', 'home.master': 'Studia magisterskie', 'home.onlyQuestions': 'Tylko z pytaniami', 'home.noContent': 'na razie pusto', 'home.dueLine': 'Do powtórki dzisiaj: {n}.',
  'home.search': 'Szukaj przedmiotu, np. SBD albo fizyka', 'home.filter.all': 'Wszystkie', 'home.filter.questions': 'Z bazą pytań', 'home.filter.materials': 'Tylko materiały',
  'home.today': 'Na dziś', 'home.due': 'Do powtórki', 'home.streak': 'Dni z rzędu', 'home.studied': 'Dzisiaj przerobione', 'home.empty': 'Nic nie pasuje do wyszukiwania.',
  'home.sem': 'Semestr {n}', 'home.mgr': 'Magisterskie, semestr {n}', 'home.blocks': 'Przedmioty blokowe', 'home.other': 'Pozostałe',
  'course.q': 'pyt.', 'course.f.one': 'plik', 'course.f.few': 'pliki', 'course.f.many': 'plików', 'course.f.other': 'pliku', 'course.onlyMaterials': 'materiały',
  'course.tab.learn': 'Nauka', 'course.tab.questions': 'Pytania', 'course.tab.materials': 'Materiały',
  'course.scope': 'Zakres', 'scope.all': 'Cały przedmiot', 'scope.colloquium': 'Kolokwia', 'scope.exam': 'Egzamin',
  'course.sources': 'Źródła', 'course.modes': 'Tryby nauki', 'course.local': 'Twoje pytania', 'course.openPpj': 'Otwórz PPJ Quiz',
  'course.noBank.title': 'Ten przedmiot nie ma gotowej bazy pytań', 'course.noBank.body': 'Ale ma materiały. Wybierz zakres, a przygotujemy z nich fiszki i testy.',
  'course.noScope.title': 'Brak kart w tym zakresie', 'course.noScope.body': 'Wygeneruj je z materiałów, dodaj własne pytania albo oznacz istniejące w zakładce Pytania.',
  'course.noMaterials': 'Do tego przedmiotu nie ma materiałów. Możesz dodać własne pytania.',
  'course.generate': 'Generuj z materiałów', 'course.generate.body': 'Pobierzemy pliki, wyciągniemy z nich tekst i przygotujemy fiszki do sprawdzenia.',
  'course.gen.all': 'Całość', 'course.gen.colloquium': 'Z kolokwiów', 'course.gen.exam': 'Z egzaminów', 'course.addOwn': 'Dodaj pytanie', 'course.decks': 'Twoje talie',
  'course.deleteDeck': 'Usunąć talię „{name}” razem z postępem?', 'course.needs': 'Za mało kart',
  'mode.flashcards': 'Fiszki', 'mode.flashcards.d': 'Odwracaj karty i oznaczaj, co już umiesz.',
  'mode.review': 'Powtórki', 'mode.review.d': 'System jak w Anki: karty wracają wtedy, gdy zaczynasz je zapominać.',
  'mode.learn': 'Ucz się', 'mode.learn.d': 'Rundy pytań, które wracają, dopóki ich nie opanujesz.',
  'mode.write': 'Pisanie', 'mode.write.d': 'Wpisz odpowiedź z pamięci.',
  'mode.test': 'Test', 'mode.test.d': 'Symulacja kolokwium lub egzaminu z wynikiem.',
  'mode.match': 'Dopasowanie', 'mode.match.d': 'Łącz pary na czas.',
  'mode.truefalse': 'Prawda / fałsz', 'mode.truefalse.d': 'Szybka ocena stwierdzeń.',
  'mode.open': 'Pytania otwarte', 'mode.open.d': 'Pytania z arkuszy bez klucza. Odpowiedz własnymi słowami i oznacz, co już umiesz.',
  'open.note': 'Twoja odpowiedź lub notatka', 'open.noKeyHint': 'Do tego pytania nie ma poprawnej odpowiedzi, sprawdź ją w materiałach.', 'open.source': 'Źródło', 'open.know': 'Umiem', 'open.again': 'Do powtórki', 'open.hideKnown': 'Ukryj te, które umiem', 'open.known': 'Umiesz {a} z {b}', 'open.done': 'To wszystkie pytania', 'open.doneBody': 'Umiesz {a} z {b}.', 'open.restart': 'Przejrzyj ponownie', 'open.options': 'Odpowiedzi z arkusza',
  'lang.study': 'Studiuję', 'lang.study.pl': 'po polsku', 'lang.study.en': 'po angielsku', 'lang.none.pl': 'Brak pytań po polsku', 'lang.none.en': 'Brak pytań po angielsku', 'lang.none.body': 'W tym przedmiocie są pytania tylko w drugim języku ({n}). Język studiów możesz zmienić powyżej.',
  'mode.list': 'Lista pytań', 'mode.list.d': 'Przejrzyj wszystkie pytania z odpowiedziami.', 'home.openList': 'Otwórz listę pytań',
  'questions.type.all': 'Wszystkie', 'questions.type.closed': 'Z odpowiedzią', 'questions.type.open': 'Otwarte', 'questions.showAnswers': 'Pokazuj poprawne odpowiedzi', 'questions.showAll': 'Pokaż wszystkie ({n})', 'questions.none': 'Nie ma pytań spełniających te warunki.',
  'questions.search': 'Szukaj w pytaniach', 'questions.count': 'Wyników: {n}', 'questions.comments': 'Komentarze ({n})', 'questions.setScope': 'Zakres pytania', 'questions.noKey': 'bez klucza',
  'materials.docsOnly': 'Tylko dokumenty i skany', 'materials.count': 'Plików: {n}', 'materials.open': 'Otwórz na GitHubie',
  'cat.all': 'Wszystkie', 'cat.exam': 'Egzaminy', 'cat.colloquium': 'Kolokwia', 'cat.lecture': 'Wykłady', 'cat.lab': 'Ćwiczenia', 'cat.other': 'Inne',
  'study.empty': 'Brak kart do tego trybu w wybranym zakresie.', 'study.progress': '{a} z {b}',
  'flash.flip': 'Odwróć', 'flash.know': 'Umiem', 'flash.dontKnow': 'Jeszcze nie', 'flash.shuffle': 'Przetasuj', 'flash.hint': 'Spacja odwraca, strzałki przełączają',
  'flash.done': 'Koniec talii', 'flash.result': 'Umiesz {a} z {b}.', 'flash.repeatUnknown': 'Powtórz nieumiane ({n})',
  'review.show': 'Pokaż odpowiedź', 'review.again': 'Powtórz', 'review.hard': 'Trudne', 'review.good': 'Dobre', 'review.easy': 'Łatwe',
  'review.new': 'Nowe w sesji', 'review.done': 'Na dziś wszystko', 'review.doneBody': 'Przerobione karty: {n}. Następne pojawią się, gdy nadejdzie ich termin.', 'review.more': 'Dodaj 20 nowych kart',
  'learn.mastered': 'Opanowane: {a} z {b}', 'learn.typeIt': 'Teraz wpisz odpowiedź', 'learn.multi': 'Zaznacz wszystkie poprawne', 'learn.done': 'Runda ukończona', 'learn.doneBody': 'Opanowane karty w tej rundzie: {n}.', 'learn.nextRound': 'Następna runda',
  'write.placeholder': 'Twoja odpowiedź', 'write.correctIs': 'Poprawna odpowiedź:', 'write.iWasRight': 'Moja odpowiedź była dobra', 'write.done': 'Koniec', 'write.score': 'Wynik: {a} z {b}',
  'test.setup': 'Ustawienia testu', 'test.count': 'Liczba pytań', 'test.allCount': 'Wszystkie ({n})', 'test.time': 'Limit czasu', 'test.noLimit': 'Bez limitu', 'test.minutes': '{n} min', 'test.instant': 'Pokazuj odpowiedź od razu', 'test.start': 'Rozpocznij test',
  'test.finish': 'Zakończ test', 'test.confirm': 'Bez odpowiedzi: {n}. Zakończyć test?', 'test.result': 'Wynik testu', 'test.correct': 'Poprawne', 'test.score': 'Procent', 'test.answered': 'Z odpowiedzią',
  'test.review': 'Pomyłki ({n})', 'test.noMistakes': 'Bezbłędnie!', 'test.retry': 'Popraw błędy', 'test.toReview': 'Dodaj błędy do powtórek', 'test.added': 'Dodano do powtórek', 'test.your': 'Twoja odpowiedź', 'test.skipped': 'Pominięte', 'test.right': 'Poprawna', 'test.new': 'Nowy test', 'test.timeLeft': 'Pozostały czas',
  'match.time': 'Czas', 'match.best': 'Rekord', 'match.done': 'Ułożone w {t}', 'match.new': 'Nowa gra',
  'tf.true': 'Prawda', 'tf.false': 'Fałsz', 'tf.score': 'Wynik: {a} z {b}', 'tf.claim': 'Czy to poprawna odpowiedź?',
  'gen.title': 'Generator fiszek', 'gen.pick': 'Wybierz materiały', 'gen.selected': 'Wybrane: {n}', 'gen.upload': 'Dodaj własny plik', 'gen.paste': 'Albo wklej tekst', 'gen.pastePh': 'Wklej notatki, pytania lub treść wykładu…',
  'gen.limit': 'Wybierz najwyżej {n} plików naraz.', 'gen.cloze': 'Twórz też luki w zdaniach', 'gen.run': 'Generuj fiszki', 'gen.running': 'Przetwarzanie {a} z {b}', 'gen.stop': 'Zatrzymaj', 'gen.none': 'Nie ma tu plików, z których da się odczytać tekst.',
  'gen.ocrNote': 'Skany są odczytywane przez OCR, co trwa dłużej i bywa niedokładne, szczególnie przy piśmie odręcznym.',
  'gen.result': 'Sprawdź fiszki', 'gen.found': 'Znaleziono {n}, wybrano {m}', 'gen.nothing': 'Nie znaleziono niczego, co da się zamienić na fiszki. Użyj AI poniżej albo wklej własne pytania.',
  'gen.deckName': 'Nazwa talii', 'gen.deckScope': 'Zakres talii', 'gen.saveDeck': 'Zapisz talię', 'gen.noAnswer': 'bez odpowiedzi', 'gen.backPh': 'Odpowiedź (uzupełnij, jeśli brak)', 'gen.fileFailed': 'Nie udało się odczytać', 'gen.fileEmpty': 'Brak tekstu',
  'gen.type.qa': 'pytanie', 'gen.type.mcq': 'test', 'gen.type.open': 'otwarte', 'gen.type.definition': 'definicja', 'gen.type.outline': 'lista', 'gen.type.cloze': 'luka', 'gen.selectAll': 'Zaznacz wszystko', 'gen.selectNone': 'Odznacz wszystko',
  'gen.ai': 'Lepsze fiszki z AI', 'gen.ai.body': 'Skopiuj polecenie z tekstem materiałów do dowolnego czatu AI, a jego odpowiedź wklej poniżej. Sprawdź wynik, bo AI też się myli.', 'gen.ai.copy': 'Kopiuj polecenie dla AI', 'gen.ai.copied': 'Skopiowano', 'gen.ai.ph': 'Wklej odpowiedź AI (JSON) albo fiszki w formacie „przód :: tył”', 'gen.ai.add': 'Dodaj do listy', 'gen.ai.bad': 'Nie rozpoznano formatu.', 'gen.back': 'Zmień materiały',
  'add.title': 'Dodaj pytania', 'add.lead': 'Pytania działają od razu we wszystkich trybach nauki. Możesz je też opublikować dla innych.',
  'add.course': 'Przedmiot', 'add.single': 'Jedno pytanie', 'add.bulk': 'Wiele naraz', 'add.kind.test': 'Testowe', 'add.kind.card': 'Fiszka', 'add.question': 'Pytanie', 'add.front': 'Przód', 'add.back': 'Tył', 'add.questionPh': 'Treść pytania. Działa Markdown, np. `kod`', 'add.code': 'Kod (opcjonalnie)', 'add.answers': 'Odpowiedzi', 'add.answersHint': 'Zaznacz poprawne', 'add.answerPh': 'Odpowiedź {n}', 'add.addAnswer': 'Dodaj odpowiedź', 'add.why': 'Wyjaśnienie (opcjonalnie)', 'add.scope': 'Zakres', 'add.submit': 'Dodaj pytanie', 'add.update': 'Zapisz zmiany', 'add.shortcut': 'Ctrl + Enter', 'add.preview': 'Podgląd',
  'add.needText': 'Wpisz treść pytania.', 'add.needAnswers': 'Podaj co najmniej dwie odpowiedzi i zaznacz poprawną.', 'add.needBack': 'Uzupełnij tył fiszki.', 'add.added': 'Dodano. Możesz wpisać kolejne.', 'add.saveFailed': 'Pamięć przeglądarki jest pełna, więc nie zapisano zmian.',
  'add.bulkHelp': 'Oddziel pytania pustą linią. Poprawne odpowiedzi zacznij od +, błędne od -. Działają też eksporty z Quizleta i Anki (przód, tabulator, tył) oraz linie „przód :: tył”.', 'add.bulkExample': 'Który port domyślnie obsługuje HTTPS?\n- 80\n+ 443\n- 21\n\nCo oznacza skrót ACID :: Atomicity, Consistency, Isolation, Durability', 'add.bulkFound': 'Rozpoznano: {n}', 'add.bulkAdd': 'Dodaj {n}',
  'add.mine': 'Twoje pytania z tego przedmiotu ({n})', 'add.publish': 'Opublikuj dla wszystkich', 'add.publishHint': 'Otworzy się zgłoszenie na GitHubie. Po jego wysłaniu pytania trafią na stronę automatycznie albo po akceptacji.', 'add.publishCopied': 'Treść jest za długa na link, więc skopiowano ją do schowka. Wklej ją w zgłoszeniu.', 'add.deleteConfirm': 'Usunąć to pytanie?', 'add.pick': 'Wybierz przedmiot',
  'data.title': 'Twoje dane', 'data.lead': 'Postępy, własne pytania i talie są tylko w tej przeglądarce. Eksport pozwala je przenieść albo zachować.', 'data.export': 'Eksportuj do pliku', 'data.import': 'Importuj z pliku', 'data.reset': 'Usuń wszystko', 'data.resetConfirm': 'Usunąć wszystkie postępy, pytania i talie? Tego nie da się cofnąć.', 'data.importConfirm': 'Import zastąpi obecne dane. Kontynuować?', 'data.imported': 'Zaimportowano.', 'data.bad': 'To nie jest poprawny plik eksportu.', 'data.cards': 'Karty w powtórkach', 'data.own': 'Własne pytania', 'data.decks': 'Talie',
  'notfound': 'Nie ma takiej strony.', 'notfound.home': 'Przejdź do przedmiotów',
};

export type Key = keyof typeof pl;

const en: Record<Key, string> = {
  'nav.courses': 'Courses', 'nav.add': 'Add questions', 'nav.materials': 'Add materials', 'nav.data': 'Your data',
  'amat.title': 'Add materials', 'amat.lead': 'Colloquia, exams and notes go to the Materials tab and the flashcard generator.', 'amat.category': 'Material type', 'amat.open': 'Go to file upload',
  'amat.step1': 'On GitHub, drag your files into the text box and wait for them to upload.', 'amat.step2': 'Click “Create” (or “Submit new issue”).', 'amat.step3': "The owner's files appear within a few minutes, and everyone else's after approval.",
  'amat.rules': 'You need a GitHub account. Allowed files: PDF, DOC, DOCX, PPT, PPTX, ODT, RTF, TXT, MD, JPG and PNG, up to 25 MB each and 20 at a time. Files are public, so only add ones you are allowed to share.', 'amat.pending': 'Submissions awaiting approval',
  'amat.issueBody': 'Drag your files here and leave the block above unchanged:', 'materials.own': 'added here', 'course.addMaterial': 'Add material',
  'theme.toLight': 'Switch to light theme', 'theme.toDark': 'Switch to dark theme', 'lang.switch': 'Przełącz na polski',
  'common.loading': 'Loading…', 'common.error': 'Could not load the data. Refresh the page.', 'common.back': 'Back',
  'common.delete': 'Delete', 'common.edit': 'Edit', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.next': 'Next', 'common.prev': 'Previous',
  'common.check': 'Check', 'common.again': 'Try again', 'common.finish': 'Finish', 'common.showMore': 'Show more', 'common.search': 'Search',
  'common.correct': 'Correct!', 'common.wrong': 'Not quite', 'common.noKey': 'The source has no answer key.', 'common.backToCourse': 'Back to course',
  'about.based': 'Built on {zdaj} ({code}) by {author}.',
  'footer.credits': 'Questions and materials: {data} and {files} under {ccby}, reformatted and with corrections merged. PPJ quiz: {ppj}. Site code: {mit}.',
  'footer.local': 'Progress is stored only in this browser.',
  'home.title': 'Study plan', 'home.lead': 'Computer Science, BEng, {program}. Pick a course to start studying.', 'home.program': '2025/26 programme', 'home.column': 'Semester {n}', 'home.elective': 'elective', 'home.archive': 'Outside the current programme', 'home.master': "Master's studies", 'home.onlyQuestions': 'Only with questions', 'home.noContent': 'nothing yet', 'home.dueLine': 'Due for review today: {n}.',
  'home.search': 'Search courses, e.g. SBD or physics', 'home.filter.all': 'All', 'home.filter.questions': 'With questions', 'home.filter.materials': 'Materials only',
  'home.today': 'Today', 'home.due': 'Due for review', 'home.streak': 'Day streak', 'home.studied': 'Studied today', 'home.empty': 'Nothing matches your search.',
  'home.sem': 'Semester {n}', 'home.mgr': "Master's, semester {n}", 'home.blocks': 'Block courses', 'home.other': 'Other',
  'course.q': 'questions', 'course.f.one': 'file', 'course.f.few': 'files', 'course.f.many': 'files', 'course.f.other': 'files', 'course.onlyMaterials': 'materials',
  'course.tab.learn': 'Study', 'course.tab.questions': 'Questions', 'course.tab.materials': 'Materials',
  'course.scope': 'Scope', 'scope.all': 'Whole course', 'scope.colloquium': 'Colloquia', 'scope.exam': 'Exam',
  'course.sources': 'Sources', 'course.modes': 'Study modes', 'course.local': 'Your questions', 'course.openPpj': 'Open PPJ Quiz',
  'course.noBank.title': 'This course has no question bank yet', 'course.noBank.body': 'It does have materials. Pick a scope and we will turn them into flashcards and tests.',
  'course.noScope.title': 'No cards in this scope', 'course.noScope.body': 'Generate them from materials, add your own, or tag existing ones in the Questions tab.',
  'course.noMaterials': 'This course has no materials. You can add your own questions.',
  'course.generate': 'Generate from materials', 'course.generate.body': 'We download the files, extract their text and prepare flashcards for you to review.',
  'course.gen.all': 'Everything', 'course.gen.colloquium': 'From colloquia', 'course.gen.exam': 'From exams', 'course.addOwn': 'Add a question', 'course.decks': 'Your decks',
  'course.deleteDeck': 'Delete the deck “{name}” and its progress?', 'course.needs': 'Not enough cards',
  'mode.flashcards': 'Flashcards', 'mode.flashcards.d': 'Flip cards and mark what you already know.',
  'mode.review': 'Review', 'mode.review.d': 'Anki-style scheduling: cards return just as you start to forget them.',
  'mode.learn': 'Learn', 'mode.learn.d': 'Rounds of questions that return until you master them.',
  'mode.write': 'Write', 'mode.write.d': 'Type the answer from memory.',
  'mode.test': 'Test', 'mode.test.d': 'A scored colloquium or exam simulation.',
  'mode.match': 'Match', 'mode.match.d': 'Connect the pairs against the clock.',
  'mode.truefalse': 'True / false', 'mode.truefalse.d': 'Judge statements quickly.',
  'mode.open': 'Open questions', 'mode.open.d': 'Exam sheet questions with no answer key. Answer in your own words and mark what you know.',
  'open.note': 'Your answer or note', 'open.noKeyHint': 'This question has no correct answer on file, so check it in the materials.', 'open.source': 'Source', 'open.know': 'I know this', 'open.again': 'Review again', 'open.hideKnown': 'Hide ones I know', 'open.known': 'You know {a} of {b}', 'open.done': 'That was every question', 'open.doneBody': 'You know {a} of {b}.', 'open.restart': 'Go through again', 'open.options': 'Answers from the sheet',
  'lang.study': 'I study', 'lang.study.pl': 'in Polish', 'lang.study.en': 'in English', 'lang.none.pl': 'No questions in Polish', 'lang.none.en': 'No questions in English', 'lang.none.body': 'This course only has questions in the other language ({n}). You can change your study language above.',
  'mode.list': 'Question list', 'mode.list.d': 'Browse every question with its answers.', 'home.openList': 'Open the question list',
  'questions.type.all': 'All', 'questions.type.closed': 'With answers', 'questions.type.open': 'Open', 'questions.showAnswers': 'Show correct answers', 'questions.showAll': 'Show all ({n})', 'questions.none': 'No questions match these filters.',
  'questions.search': 'Search questions', 'questions.count': 'Results: {n}', 'questions.comments': 'Comments ({n})', 'questions.setScope': 'Question scope', 'questions.noKey': 'no key',
  'materials.docsOnly': 'Documents and scans only', 'materials.count': 'Files: {n}', 'materials.open': 'Open on GitHub',
  'cat.all': 'All', 'cat.exam': 'Exams', 'cat.colloquium': 'Colloquia', 'cat.lecture': 'Lectures', 'cat.lab': 'Exercises', 'cat.other': 'Other',
  'study.empty': 'No cards for this mode in the selected scope.', 'study.progress': '{a} of {b}',
  'flash.flip': 'Flip', 'flash.know': 'Know it', 'flash.dontKnow': 'Not yet', 'flash.shuffle': 'Shuffle', 'flash.hint': 'Space flips, arrows navigate',
  'flash.done': 'End of deck', 'flash.result': 'You know {a} of {b}.', 'flash.repeatUnknown': 'Repeat unknown ({n})',
  'review.show': 'Show answer', 'review.again': 'Again', 'review.hard': 'Hard', 'review.good': 'Good', 'review.easy': 'Easy',
  'review.new': 'New this session', 'review.done': 'All done for today', 'review.doneBody': 'Cards reviewed: {n}. More will appear when they are due.', 'review.more': 'Add 20 new cards',
  'learn.mastered': 'Mastered: {a} of {b}', 'learn.typeIt': 'Now type the answer', 'learn.multi': 'Select all that apply', 'learn.done': 'Round complete', 'learn.doneBody': 'You mastered {n} cards this round.', 'learn.nextRound': 'Next round',
  'write.placeholder': 'Your answer', 'write.correctIs': 'Correct answer:', 'write.iWasRight': 'My answer was right', 'write.done': 'Finished', 'write.score': 'Score: {a} of {b}',
  'test.setup': 'Test settings', 'test.count': 'Number of questions', 'test.allCount': 'All ({n})', 'test.time': 'Time limit', 'test.noLimit': 'No limit', 'test.minutes': '{n} min', 'test.instant': 'Show the answer immediately', 'test.start': 'Start test',
  'test.finish': 'Finish test', 'test.confirm': 'Unanswered: {n}. Finish the test?', 'test.result': 'Test result', 'test.correct': 'Correct', 'test.score': 'Score', 'test.answered': 'Answered',
  'test.review': 'Mistakes ({n})', 'test.noMistakes': 'No mistakes!', 'test.retry': 'Retry mistakes', 'test.toReview': 'Add mistakes to review', 'test.added': 'Added to review', 'test.your': 'Your answer', 'test.skipped': 'Skipped', 'test.right': 'Correct', 'test.new': 'New test', 'test.timeLeft': 'Time left',
  'match.time': 'Time', 'match.best': 'Best', 'match.done': 'Cleared in {t}', 'match.new': 'New game',
  'tf.true': 'True', 'tf.false': 'False', 'tf.score': 'Score: {a} of {b}', 'tf.claim': 'Is this a correct answer?',
  'gen.title': 'Flashcard generator', 'gen.pick': 'Choose materials', 'gen.selected': 'Selected: {n}', 'gen.upload': 'Add your own file', 'gen.paste': 'Or paste text', 'gen.pastePh': 'Paste notes, questions or lecture content…',
  'gen.limit': 'Select at most {n} files at once.', 'gen.cloze': 'Also create fill-in-the-blank cards', 'gen.run': 'Generate flashcards', 'gen.running': 'Processing {a} of {b}', 'gen.stop': 'Stop', 'gen.none': 'There are no files here that text can be read from.',
  'gen.ocrNote': 'Scans are read with OCR, which takes longer and can be inaccurate, especially for handwriting.',
  'gen.result': 'Review your flashcards', 'gen.found': 'Found {n}, selected {m}', 'gen.nothing': 'Nothing could be turned into flashcards. Use AI below or paste your own questions.',
  'gen.deckName': 'Deck name', 'gen.deckScope': 'Deck scope', 'gen.saveDeck': 'Save deck', 'gen.noAnswer': 'no answer', 'gen.backPh': 'Answer (fill in if missing)', 'gen.fileFailed': 'Could not read', 'gen.fileEmpty': 'No text',
  'gen.type.qa': 'question', 'gen.type.mcq': 'test', 'gen.type.open': 'open', 'gen.type.definition': 'definition', 'gen.type.outline': 'list', 'gen.type.cloze': 'blank', 'gen.selectAll': 'Select all', 'gen.selectNone': 'Select none',
  'gen.ai': 'Better flashcards with AI', 'gen.ai.body': 'Copy the prompt with the extracted text into any AI chat and paste its reply below. Check the result, because AI makes mistakes too.', 'gen.ai.copy': 'Copy AI prompt', 'gen.ai.copied': 'Copied', 'gen.ai.ph': 'Paste the AI reply (JSON) or cards as “front :: back”', 'gen.ai.add': 'Add to list', 'gen.ai.bad': 'Format not recognized.', 'gen.back': 'Change materials',
  'add.title': 'Add questions', 'add.lead': 'Questions work right away in every study mode. You can also publish them for others.',
  'add.course': 'Course', 'add.single': 'One question', 'add.bulk': 'Many at once', 'add.kind.test': 'Multiple choice', 'add.kind.card': 'Flashcard', 'add.question': 'Question', 'add.front': 'Front', 'add.back': 'Back', 'add.questionPh': 'Question text. Markdown works, e.g. `code`', 'add.code': 'Code (optional)', 'add.answers': 'Answers', 'add.answersHint': 'Tick the correct ones', 'add.answerPh': 'Answer {n}', 'add.addAnswer': 'Add answer', 'add.why': 'Explanation (optional)', 'add.scope': 'Scope', 'add.submit': 'Add question', 'add.update': 'Save changes', 'add.shortcut': 'Ctrl + Enter', 'add.preview': 'Preview',
  'add.needText': 'Enter the question text.', 'add.needAnswers': 'Give at least two answers and tick a correct one.', 'add.needBack': 'Fill in the back of the card.', 'add.added': 'Added. You can enter the next one.', 'add.saveFailed': 'Browser storage is full, so the changes were not saved.',
  'add.bulkHelp': 'Separate questions with a blank line. Start correct answers with + and wrong ones with -. Quizlet and Anki exports (front, tab, back) and “front :: back” lines also work.', 'add.bulkExample': 'Which port does HTTPS use by default?\n- 80\n+ 443\n- 21\n\nWhat does ACID stand for :: Atomicity, Consistency, Isolation, Durability', 'add.bulkFound': 'Recognized: {n}', 'add.bulkAdd': 'Add {n}',
  'add.mine': 'Your questions for this course ({n})', 'add.publish': 'Publish for everyone', 'add.publishHint': 'This opens a GitHub issue. Once you submit it, the questions reach the site automatically or after approval.', 'add.publishCopied': 'The content is too long for a link, so it was copied to your clipboard. Paste it into the issue.', 'add.deleteConfirm': 'Delete this question?', 'add.pick': 'Choose a course',
  'data.title': 'Your data', 'data.lead': 'Progress, your questions and decks exist only in this browser. Export lets you move or back them up.', 'data.export': 'Export to file', 'data.import': 'Import from file', 'data.reset': 'Delete everything', 'data.resetConfirm': 'Delete all progress, questions and decks? This cannot be undone.', 'data.importConfirm': 'Importing replaces your current data. Continue?', 'data.imported': 'Imported.', 'data.bad': 'This is not a valid export file.', 'data.cards': 'Cards in review', 'data.own': 'Own questions', 'data.decks': 'Decks',
  'notfound': 'Page not found.', 'notfound.home': 'Go to courses',
};

const dictionaries = { pl, en };

export type Translate = (key: Key, vars?: Record<string, string | number>) => string;

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Translate;
}

const Context = createContext<I18n | null>(null);

function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === 'pl' || stored === 'en') return stored;
  } catch {
    /* storage may be blocked */
  }
  return navigator.language.toLowerCase().startsWith('pl') ? 'pl' : 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* the choice just won't persist */
    }
  }, []);

  const value = useMemo<I18n>(() => ({
    lang,
    setLang,
    t: (key, vars) => {
      let text: string = dictionaries[lang][key];
      for (const [name, v] of Object.entries(vars ?? {})) text = text.split(`{${name}}`).join(String(v));
      return text;
    },
  }), [lang, setLang]);

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n() {
  const value = useContext(Context);
  if (!value) throw new Error('I18nProvider missing');
  return value;
}
