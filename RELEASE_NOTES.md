# SIO 0.3.0

- Fälle archivieren und wieder aktivieren. Alle Daten bleiben erhalten; aktive Fristen und Auslastungen ignorieren archivierte Fälle. Erreichbar im Fallstatusfilter Archiv.
- Einzelne Fälle inklusive Verlauf löschen, nach Warnung und Eingabe der Fall-ID. Schulen und Begleitungen bleiben erhalten.
- Vollständiger Reset unter Einstellungen nach Warnung und Eingabe von RESET: leert Fälle, Begleitungen, Schulen, Kommunen und Verlauf; setzt Fristeinstellungen zurück.
- Vor Löschen und Reset entsteht eine JSON-Sicherung. Schlägt sie fehl, wird nichts gelöscht. Sicherungen und bereits exportierte Dateien bleiben erhalten.
- Excel-Export und -Import erhalten den Fallarchivstatus.
- Demo-Schaltfläche und Generator aus der Anwendung entfernt. Neue Installationen starten leer; vorhandene Daten bleiben beim Update erhalten.

## Download

**SIO-Setup-0.3.0-x64.exe** installiert SIO für den aktuellen Windows-Benutzer.

**SIO-0.3.0-portable-x64.exe** startet ohne Installation. Auch diese Version speichert im Windows-Benutzerprofil.

Vor dem Start eine laufende ältere SIO-Version schließen. Das Release enthält keine Falldaten. Windows-Binaries sind nicht signiert; Datenbank und Sicherungen sind unverschlüsselt.
