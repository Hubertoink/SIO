# SIO – lokale Fallkoordination

SIO bildet die Excel-Struktur mit **Fallliste, Fälle, Begleitungen und Auswertung** als eigenständige Windows-Anwendung ab. Gestaltung orientiert an StatO; kein Server erforderlich.

## Start

[Windows-Download unter Releases](https://github.com/Hubertoink/SIO/releases/latest): Installer oder portable EXE herunterladen. Eine bereits laufende ältere Version vorher schließen. Weder Node.js noch Python oder Excel werden zum Benutzen benötigt. Die Windows-Binaries sind nicht signiert.

Der Installer richtet SIO für den aktuellen Windows-Benutzer ein. Die portable EXE benötigt keine Installation; Daten werden trotzdem im Benutzerprofil gespeichert. Für lokal gebaute Versionen lässt sich `release-sio-0.3.0/win-unpacked/SIO.exe` direkt öffnen; dabei muss der gesamte Ordner zusammenbleiben.

## Bedienung

- **Dashboard:** Fälle mit überfälligen, bald fälligen oder fehlenden Terminen. Die Karten filtern die Fallliste. Mehrere betroffene Fristarten stehen gemeinsam in „Was ist fällig?“.
- **Fälle:** Suche, Status-/Frist-/Kommunenfilter und Sortierung über die Spaltenüberschriften. Ein Fall öffnet seine Akte mit Dokumentation, Kontakt und aufklappbarem Verlauf. „Beendet“ deaktiviert Fristwarnungen. „Ruhend“ bleibt fristrelevant.
- **Fall anlegen / bearbeiten:** Stammdaten einschließlich Diagnose, Fristen, laufende Dokumentation und optionale Kontakte sind auf vier Bereiche verteilt. Historische Rechnungs-/Dokumentationsdaten dürfen nicht in der Zukunft liegen. Unvollständige Fristen dürfen gespeichert werden und bleiben als Hinweis sichtbar.
- **Begleitungen:** Eine konkrete Person oder ein ganzer Träger; intern/extern, Arbeitgeber, Ansprechperson, Kontaktdaten, Qualifikation und Wochenkapazität. Fälle verknüpfen stabile IDs, die Auswahl zeigt Namen.
- **Stammdaten:** Schulen und Kommunen einmalig anlegen. Identische Einträge sind gesperrt, ähnliche Namen lösen einen Hinweis aus. Die Kommune der Schule wird beim Fall vorbelegt, sofern dort noch keine zuständige Kommune steht; eine abweichende Zuständigkeit ist möglich.
- **Einstellungen:** Vorlauf Bewilligung, Vorlauf Bedarfsplanung, Rechnungsabstand, Vorwarnung Rechnung. Nächste Rechnung = letztes Rechnungsdatum + Rechnungsabstand in Kalendertagen. Eine Vorwarnung schließt den Grenztag ein.

## Excel und Sicherungen

Der Excel-Export enthält vier Reiter in der bekannten Reihenfolge. Fälle und Begleitungen sind Eingabebereiche; die Fallliste enthält Formeln, Filter, Fristfarben und berechnete Zuordnungen. 200 Fallzeilen und 100 Begleitungszeilen sind mindestens vorbereitet. Die Formeln berechnen mit dem aktuellen Tag. Die Mappe kann bearbeitet und erneut importiert werden.

Der Import erwartet diese Spaltenüberschriften und stabile IDs. Er validiert den gesamten Datenbestand vor der Übernahme und zeigt eine Vorschau. Er **ersetzt** den aktuellen Datenbestand; vorher wird eine Sicherung angelegt. Excel enthält den aktuellen Stand, keinen Änderungsverlauf. Eine **SIO-JSON-Sicherung** enthält zusätzlich den Verlauf und kann über denselben Import wiederhergestellt werden.

Daten liegen unter `%APPDATA%/SIO/sco.sqlite`. Automatische JSON-Sicherungen entstehen beim Start mit vorhandenem Datenbestand und vor jedem Import; die letzten 20 bleiben erhalten. In den Einstellungen lässt sich eine zusätzliche Sicherung an einem frei gewählten Ort speichern. Der Anwendungsordner enthält keine Falldaten.

Die App arbeitet ohne Netzwerkverbindungen. Datenbank und Sicherungen sind nicht verschlüsselt. Es handelt sich um eine Einzelplatz-Testversion ohne Rollenverwaltung, Benutzeranmeldung, signierte Updates oder manipulationssicheres Audit. Der Verlauf dokumentiert Änderungen lokal, ist aber kein revisionssicheres Archiv.

## Entwicklung und Prüfung

Voraussetzung: Node.js 24 oder neuer, npm; Windows für die Windows-Release-Erstellung.

```powershell
npm ci
npm test
npm run test:ui
npm run build
npm start
npm run pack
npm run release
```

Electron mit isoliertem, sandboxed Renderer; Zugriff auf SQLite, Import und Export ausschließlich über begrenzte IPC-Methoden. Keine beliebigen Dateipfade aus dem Renderer, kein Node-Zugriff im Renderer, keine externen Seiten oder Fenster. SQLite-Transaktionen und Revisionskontrolle schützen die Schreibvorgänge. Die gemeinsame Fachlogik liegt in `shared/model.mjs`.

Die Tests prüfen Datumsgrenzen, Fristbündelung, beendete Fälle, Eingabeprüfung, Dubletten, dauerhafte Speicherung, Konflikte, Import-Atomarität, Excel-Rundlauf sowie Formular- und Navigationsabläufe. Ein Excel-Rundlauf bestätigt Daten und Formel-Caches; er ersetzt keine vollständige Prüfung aller Formeln in Microsoft Excel.

## Tastatur

Enter speichert Kommune oder Schule aus einem einzeiligen Textfeld. In Auswahllisten bestätigt Enter die Auswahl. Strg+Enter und Strg+S speichern das aktive Formular; Escape schließt es mit Rückfrage bei ungespeicherten Eingaben. Direkt im Schulformular kann eine neue Kommune angelegt werden, ohne den Schulnamen zu verlieren.


Ein bereits vorhandener Datenordner `%APPDATA%/SCO` aus dem ersten Testbuild wird weiterverwendet, damit bisher gespeicherte Einträge erhalten bleiben. Sicherungen aus dem ersten Build sind weiterhin importierbar.

## Direkte Bearbeitung und Archiv (0.1.2)

Der Stift oben rechts in jeder Karte der Fallakte schaltet die Felder direkt in den Bearbeitungsmodus. Speichern per Diskette, Strg+Enter oder Strg+S; Abbrechen per Kreuz oder Escape. Eingabeprüfung und Änderungsverlauf gelten auch hier. Änderungen an Begleitungs-Stammdaten gelten für alle mit dieser Person bzw. diesem Träger verknüpften Fälle; die Zuordnung lässt sich über den separaten Stift „Zuordnung bearbeiten“ ändern.

Die drei Fristkarten zeigen zusätzlich Resttage (Pfeil nach unten), überfällige Tage (Pfeil nach oben) oder „Heute fällig“. Fehlende Termine und beendete Fälle erhalten keinen irreführenden Tageswert.

Schulen und Begleitungen lassen sich über das Archivsymbol archivieren. Bestehende Fälle behalten ihre Zuordnung; für neue Zuordnungen werden archivierte Einträge ausgeblendet. Im Reiter „Archiv“ lassen sie sich wieder aktivieren. Excel erhält den Archivstatus der Begleitungen in einer zusätzlichen Spalte und den vollständigen Schul-/Kommunenstamm im Reiter Auswertung; eine technische Schul-ID hält die Beziehungen beim Rückimport stabil. JSON-Sicherungen enthalten weiterhin den gesamten Datenbestand einschließlich Verlauf.

Seite und Dialoginhalte reservieren den Platz für ihre Scrollbars. Die Modalsperre erfolgt ohne zusätzliche Breitenkompensation, damit das Öffnen und Schließen die Ansicht nicht verschiebt.

### Ergänzungen in 0.1.3

Die drei Fristkarten sind ebenfalls direkt bearbeitbar. Bei Rechnungsstellung wird das letzte Rechnungsdatum gepflegt; die nächste Frist bleibt daraus berechnet. Bearbeitungsstifte erscheinen bei Hover oder Tastaturfokus (auf Touchgeräten dauerhaft). Abbrechen und Speichern bleiben während der Bearbeitung sichtbar, auch bei der erstmaligen Begleitungszuordnung. Beim Schließen mit ungespeicherten Eingaben erscheint ein Appmodal statt des Windows-Dialogs.

### Ergänzungen in 0.2.0

Die beiden Begleitungsaktionen stehen an getrennten Stellen: Zuordnung beim Namen der Begleitung, Bearbeitung der gemeinsamen Stammdaten beim Inhaltsbereich. Das Original-Logo liegt unter `assets/SIO_Logo.png`; `assets/SIO_Logo.ico` enthält mehrere Windows-Icon-Größen. Beide werden in die Anwendung eingebunden. Die Tests benötigen ausschließlich fiktive, im Test erzeugte Daten.


## Fallarchiv, Löschen und Reset (0.3.0)

In der Fallakte stehen Archivieren/Wieder aktivieren und Fall löschen bereit. Archivierte Fälle behalten ihren ursprünglichen Fallstatus, alle Daten und ihren Verlauf. Sie sind im Fallstatusfilter Archiv erreichbar und werden aus aktiven Fristen und Auslastungen ausgeblendet. Excel erhält den Archivstatus in der Spalte Archiviert am.

Löschen erfordert die Fall-ID und entfernt den Fall samt Verlauf, jedoch keine gemeinsam verwendeten Stammdaten. Einstellungen → Alle Daten zurücksetzen verlangt RESET und leert den gesamten Datenbestand einschließlich Verlauf und eigener Fristeinstellungen.

Vor beiden Aktionen entsteht eine JSON-Sicherung unter backups/Vor-Loeschung- bzw. Vor-Reset-. Ohne erfolgreiche Sicherung erfolgt keine Löschung. Diese Sicherungen werden nicht von der normalen 20-Dateien-Rotation entfernt. Sicherungen und bereits exportierte Dateien bleiben erhalten; der Reset ist keine sichere physische Datenvernichtung. Wiederherstellung erfolgt über Excel / Sicherung importieren.

Die Anwendung enthält keinen Demo-Generator mehr und startet bei einer Neuinstallation leer. Testdaten liegen ausschließlich unter tests/ und werden nicht in die Anwendung gepackt. Bestehende Daten bleiben beim Update erhalten.
