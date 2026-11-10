/**
 * Informatyka, studia I stopnia stacjonarne, program 2025/2026:
 * https://pja.edu.pl/wp-content/uploads/2025/07/Informatyka_stacjonarne_pierwszy_2025_PL.pdf
 * Courses are grouped by semester. Physical education, BHP, language courses
 * after semester 3 and the diploma projects are left out on purpose.
 */
export const PROGRAM_URL = 'https://pja.edu.pl/wp-content/uploads/2025/07/Informatyka_stacjonarne_pierwszy_2025_PL.pdf';

export const PROGRAM = {
  1: [['PPJ', 'Podstawy programowania w języku Java'], ['AM', 'Analiza matematyczna'], ['TAK', 'Techniki i architektura komputerów'], ['WSI', 'Wprowadzenie do systemów informacyjnych'], ['WDZ', 'Wstęp do zarządzania'], ['HKJ', 'Historia i kultura Japonii'], ['ANG', 'Język angielski']],
  2: [['GUI', 'Programowanie obiektowe i GUI'], ['RBD', 'Relacyjne bazy danych'], ['SOP', 'Systemy operacyjne'], ['ALG', 'Algebra liniowa i geometria'], ['MAD', 'Matematyka dyskretna'], ['PPY', 'Podstawy programowania w języku Python']],
  3: [['ASD', 'Algorytmy i struktury danych'], ['SBD', 'Systemy baz danych'], ['SKJ', 'Sieci komputerowe i programowanie sieciowe w języku Java'], ['UTP', 'Uniwersalne techniki programowania'], ['SAD', 'Statystyczna analiza danych'], ['SYC', 'Systemy cyfrowe i podstawy elektroniki']],
  4: [['NAI', 'Narzędzia sztucznej inteligencji'], ['BSI', 'Bezpieczeństwo systemów informacyjnych'], ['PRI', 'Projektowanie systemów informacyjnych'], ['ICK', 'Interakcja człowiek-komputer'], ['PPB', 'Prawne podstawy działalności gospodarczej'], ['APBD', 'Aplikacje baz danych', true], ['TPO', 'Technologie programowania rozproszonego', true], ['PSM', 'Podstawy symulacji komputerowych', true], ['PCO', 'Podstawy chmury obliczeniowej', true], ['SWB', 'Systemy wbudowane', true]],
  5: [['BYT', 'Budowa i integracja systemów informatycznych'], ['GRK', 'Grafika komputerowa'], ['MUL', 'Multimedia'], ['TIN', 'Technologie Internetu', true], ['ZSK', 'Zaawansowane sieci komputerowe', true]],
  6: [['MAS', 'Modelowanie i analiza systemów informacyjnych'], ['ABD', 'Administrowanie bazami danych', true], ['ZSO', 'Zaawansowane systemy operacyjne', true], ['MIW', 'Metody inżynierii wiedzy', true], ['IPB', 'Inżynieria procesów biznesowych', true], ['TBS', 'Testowanie bezpieczeństwa systemów IT', true], ['PBIO', 'Podstawy bioinformatyki', true], ['MDD', 'Modelowanie i druk 3D', true]],
  7: [['ZPR', 'Zarządzanie projektem informatycznym'], ['AUG', 'Automaty i gramatyki', true], ['ASI', 'Architektury rozwiązań i wdrożeń SI', true], ['CMS', 'Systemy zarządzania treścią', true]],
};

/** Old or duplicate folder codes that belong to one course in the program. */
export const ALIASES = { AM1: 'AM', AM2: 'AM', ANG1: 'ANG', ANG2: 'ANG', SKO1: 'SKJ', MPR: 'UTP', WPR: 'GUI', PRG2: 'PRC' };
export const canonicalCode = (code) => ALIASES[code] ?? code;

/** Courses outside the current program, named only where the name is certain. */
export const ARCHIVE_NAMES = {
  FIZ: 'Fizyka', SKO2: 'Sieci komputerowe 2', RPG: 'Rachunkowość podmiotów gospodarczych', HUR: 'Hurtownie danych i aplikacje OLAP', PAZ: 'Prawne aspekty zarządzania',
};
