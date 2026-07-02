/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { UploadSection } from './components/UploadSection';
import { TrainingInterface } from './components/TrainingInterface';
import { StudentDashboard } from './components/StudentDashboard';
import { InstallPWA } from './components/InstallPWA';
import { extractExercises, evaluateWriting, Exercise, Evaluation } from './services/gemini';
import { Plus, CheckCircle, Clock, WifiOff, LogIn, LogOut, Cloud, User as UserIcon, Mail, Users, GraduationCap, Menu, X, Search } from 'lucide-react';
import { auth, loginWithGoogle, logout, db, OperationType, handleFirestoreError, updateUserRole, loginWithEmail, signUpWithEmail } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, where, deleteDoc } from 'firebase/firestore';
import { TeacherDashboard } from './components/TeacherDashboard';

interface SavedProgress {
  text: string;
  evaluation: Evaluation | null;
}

const DEFAULT_EXERCISES: Exercise[] = [
  {
    id: 'default-1',
    title: 'Beschwerde: Sprachreise nach Berlin',
    situation: 'Sie haben eine zweiwöchige Sprachreise nach Berlin gebucht. In der Anzeige stand: "Zentrale Unterkunft, kleine Gruppen (max. 8 Personen), erfahrene Lehrer". Vor Ort war die Unterkunft jedoch 45 Minuten vom Zentrum entfernt, die Gruppe bestand aus 15 Personen und der Lehrer war oft unpünktlich.',
    content: 'Schreiben Sie eine Beschwerde an den Veranstalter "Global Languages". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Erwartungen vs. Realité (Unterkunft, Gruppengröße)\n- Kritik am Unterricht\n- Forderung (z.B. Teilrückzahlung)',
    type: 'Beschwerde'
  },
  {
    id: 'default-2',
    title: 'Bitte um Informationen: Freiwilligenarbeit',
    situation: 'Sie interessieren sich für ein projet zur Freiwilligenarbeit im Umweltschutz in den Alpen. Sie haben eine Anzeige im Internet gesehen, aber es fehlen wichtige Details.',
    content: 'Schreiben Sie eine E-Mail an die Organisation "Alpen-Natur". Bitten Sie um Informationen zu folgenden Punkten:\n- Dauer des Projekts und tägliche Arbeitszeit\n- Unterkunft und Verpflegung\n- Voraussetzungen (Sprachkenntnisse, Erfahrung)\n- Kosten oder Aufwandsentschädigung',
    type: 'Information'
  },
  {
    id: 'default-3',
    title: 'Bewerbung um ein Praktikum',
    situation: 'Sie haben im Internet eine Anzeige für ein dreimonatiges Praktikum im Bereich Marketing bei der Firma "Mediadesign" in Hamburg gefunden.',
    content: 'Schreiben Sie Ihre Bewerbung. Behandeln Sie folgende Punkte:\n- Grund für Ihre Bewerbung\n- Ihre bisherigen Erfahrungen and Sprachkenntnisse\n- Warum Sie für dieses Unternehmen arbeiten möchten\n- Fragen zum genauen Arbeitsbeginn',
    type: 'Bewerbung'
  },
  {
    id: 'default-4',
    title: 'Beschwerde: Mietwagen im Urlaub',
    situation: 'Für Ihren einwöchigen Familienurlaub in Spanien haben Sie online bei "Rent-a-Car Premium" einen geräumigen SUV mit voll ausgestatteter Klimaanlage gebucht. Bei der Abholung am Flughafen erhielten Sie jedoch einen kleinen, dreitürigen Kleinwagen. Zudem funktionierte die Klimaanlage nicht, und der Kindersitz fehlte. Trotz mehrmaliger Bitten verweigerte der Kundenservice vor Ort jegliche Unterstützung oder einen Fahrzeugwechsel.',
    content: 'Schreiben Sie eine Beschwerde an die Zentrale von "Rent-a-Car Premium". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Abweichungen zwischen Buchung und erhaltenem Fahrzeug\n- Mangelnde Ausstattung (Klimaanlage, Kindersitz) und die Folgen\n- Unkooperatives Verhalten des Kundenservices\n- Angemessene finanzielle Entschädigung',
    type: 'Beschwerde'
  },
  {
    id: 'default-5',
    title: 'Beschwerde: Festival "Rock am See"',
    situation: 'Sie haben für das zweitägige Musikfestival "Rock am See" teure VIP-Tickets erworben, die laut Veranstalter separaten Zugang, erstklassiges Catering, exklusiven VIP-Bereich nah an der Bühne und ein Treffen mit den Künstlern beinhalteten. Die Realität war enttäuschend: Es gab keinen VIP-Eingang, die Schlangen waren stundenlang, der VIP-Bereich war überfüllt und zwei Hauptbands traten ohne Ersatz nicht auf.',
    content: 'Schreiben Sie eine Beschwerde an die Eventagentur "SummerVibes GmbH". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Fehlende vertraglich vereinbarte Leistungen (VIP-Vorteile)\n- Enttäuschung über das Catering und die Organisation\n- Ausfall der Künstler und unzureichende Kommunikation\n- Forderung auf Rückerstattung eines Teils des Ticketpreises',
    type: 'Beschwerde'
  },
  {
    id: 'default-6',
    title: 'Beschwerde: Online-Kauf eines Laptops',
    situation: 'Sie haben online über das Portal "Refurbished-Tech" ein generalüberholtes Notebook der Premiumklasse bestellt. Laut Beschreibung sollte das Gerät im Zustand "Wie neu" sein und inklusive Originalladegerät und Schutzhülle geliefert werden. Das gelieferte Notebook hatte jedoch deutliche Kratzer auf dem Bildschirm, die Akkulaufzeit lag unter 30 Minuten und das Zubehör fehlte komplett.',
    content: 'Schreiben Sie eine Beschwerde an "Refurbished-Tech Kundenservice". Behandeln Sie folgende Punkte:\n- Grund des Schreibens und Bestelldaten\n- Beschreibung der Mängel am Gerät\n- Fehlendes Zubehör (Ladegerät, Hülle)\n- Enttäuschung über die Qualitätsbeschreibung ("Wie neu")\n- Fristsetzung zur Nachbesserung, Umtausch oder Rückgabe des Geldes',
    type: 'Beschwerde'
  },
  {
    id: 'default-7',
    title: 'Bitte um Informationen: Intensivsprachkurs in Wien',
    situation: 'Sie planen, im kommenden Herbst Ihre Deutschkenntnisse zu vertiefen und sich auf die C1-Prüfung vorzubereiten. Sie stoßen auf das Angebot des "Dialog-Instituts in Wien". Das Online-Angebot klingt vielversprechend, lässt aber wesentliche organisatorische Details offen.',
    content: 'Schreiben Sie eine E-Mail an das "Dialog-Institut Wien". Bitten Sie um Informationen zu folgenden Punkten:\n- Genaue Unterrichtszeiten und Gruppengröße\n- Unterstützung bei der Wohnungssuche oder Unterkunftsmöglichkeiten\n- Spezifischer Ablauf der Vorbereitung auf die C1-Prüfung (Simulationsprüfungen)\n- Stornierungsbedingungen und Fristen bei Visumsproblemen',
    type: 'Information'
  },
  {
    id: 'default-8',
    title: 'Bitte um Informationen: Auslandspraktikum in New York',
    situation: 'Die Vermittlungsagentur "GlobalCareers" bietet sechsmonatige bezahlte Praktika im Bereich Event-Marketing und Kommunikation in New York an. Sie finden das Angebot äußerst attraktiv, benötigen jedoch klärende Details.',
    content: 'Schreiben Sie eine Anfrage-E-Mail an "GlobalCareers". Fragen Sie nach:\n- Kriterien für die Auswahl der Bewerber und notwendige Englischzertifikate\n- Durchschnittliche Höhe des Stipendiums / der Vergütung\n- Unterstützung bei der Beantragung des J-1 Visums\n- Vermittlungsgebühren und zusätzliche Kosten (z.B. Krankenversicherung)',
    type: 'Information'
  },
  {
    id: 'default-9',
    title: 'Bitte um Informationen: Messeteilnahme für Start-ups',
    situation: 'Sie vertreten das junge Food-Startup "ChocoBio" und möchten Ihr Produkt auf der Leitmesse "EcoFood Expo" in Köln präsentieren. Auf der Website finden Sie zwar das Anmeldeformular, aber keine Detailinformationen für Erstaussteller.',
    content: 'Schreiben Sie eine E-Mail an das Messeteam der "EcoFood Expo". Klären Sie folgende Punkte:\n- Kosten pro Quadratmeter für einen kleinen Ausstellungsstand\n- Möglichkeit der Beteiligung an der Startup-Area (Sonderkonditionen)\n- Zur Verfügung gestellte technische Ausstattung (Strom, Kühlgeräte)\n- Werbemöglichkeiten im offiziellen Messekatalog und auf der Website',
    type: 'Information'
  },
  {
    id: 'default-10',
    title: 'Bewerbung: Mitarbeiter an der Hotelrezeption',
    situation: 'Das Grand Hotel "Vier Jahreszeiten" in München sucht für die Sommersaison eine Aushilfe (m/w/d) an der Rezeption und für die Gästebetreuung. Vorausgesetzt werden verhandlungssichere Deutsch- und Englischkenntnisse sowie ein freundliches Auftreten.',
    content: 'Schreiben Sie Ihr Bewerbungsschreiben. Gehen Sie auf folgende Punkte ein:\n- Grund für Ihre Bewerbung und Bezugnahme auf die Stellenanzeige\n- Ihre Sprachkenntnisse und Ausbildung\n- Bisherige Kundenservice- oder Gastronomieerfahrungen\n- Motivation, für dieses renommierte Hotel zu arbeiten\n- Ihre zeitliche Verfügbarkeit im Sommer',
    type: 'Bewerbung'
  },
  {
    id: 'default-11',
    title: 'Bewerbung: Duales Studium "Tourismusmanagement"',
    situation: 'Sie interessieren sich für ein dreijähriges duales Studium im Bereich Tourismusmanagement mit einem Mix aus Theoriezeiten an der Hochschule und Praxisphasen bei der "Rheinland Reise Gruppe GmbH". Diese vergibt für das nächste Studienjahr zwei begehrte Plätze.',
    content: 'Schreiben Sie Ihre Bewerbung für das Duale Studium an die Personalabteilung der "Rheinland Reise Gruppe". Behandeln Sie folgende Punkte:\n- Warum Sie sich für den Studiengang Tourismusmanagement entschieden haben\n- Ihre schulischen Leistungen und relevanten Sprachkenntnisse (Deutsch, Englisch)\n- Erste Erfahrungen im Tourismus- oder Servicebereich\n- Warum Sie die Rheinland Reise Gruppe als Praxispartner wählen\n- Ihre Erwartungen an das duale System',
    type: 'Bewerbung'
  },
  {
    id: 'default-12',
    title: 'Bewerbung: Aushilfe in einer Buchhandlung',
    situation: 'Die traditionsreiche Buchhandlung "Buch & Kaffee" in Frankfurt sucht ab sofort eine studentische Aushilfe (m/w/d) für die Wochenenden (Samstage) zur Betreuung der Kunden und zur Pflege der Buchbestände.',
    content: 'Schreiben Sie Ihre Bewerbung an den Inhaber Herrn Peters. Behandeln Sie folgende Punkte:\n- Warum Sie in einer Buchhandlung arbeiten möchten\n- Ihre persönliche Lese-Affinität und Lieblingsgenres\n- Ihre Erfahrungen im Umgang mit Kunden (Freundlichkeit, Service)\n- Ihre Zuverlässigkeit und zeitliche Flexibilität am Samstag\n- Ihr gewünschter Arbeitsbeginn',
    type: 'Bewerbung'
  },
  {
    id: 'default-13',
    title: 'Beschwerde: Wellness-Wochenende',
    situation: 'Sie haben zur Entspannung ein "Premium-Wellness-Wochenende" im Hotel "Alpenoase" gebucht. Laut Prospekt: beheizter Infinity-Pool, ruhige Lage, 5-Sterne-Zimmerservice und drei Massagen inklusive. Vor Ort: Der Pool war wegen Bauarbeiten gesperrt, lauter Lärm im Hotel ab 7 Uhr morgens, der Zimmerservice unvollständig und es gab nur eine Massage, weil das Personal unterbesetzt war.',
    content: 'Schreiben Sie eine Beschwerde an die Hotelleitung. Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens\n- Kritik an den Wellness-Anlagen (Pool-Schließung)\n- Lärmbelästigung und mangelnder Service\n- Nicht erbrachte gebuchte Leistungen (Massagen)\n- Forderung nach einer angemessenen Entschädigung',
    type: 'Beschwerde'
  },
  {
    id: 'default-14',
    title: 'Bitte um Infos: Weiterbildung Projektmanagement',
    situation: 'Sie sind berufstätig im Bereich Logistik und möchten eine zertifizierte berufsbegleitende Weiterbildung im Bereich "Agiles Projektmanagement" absolvieren. Sie haben ein Angebot der Akademie "EduFuture" online gefunden.',
    content: 'Schreiben Sie eine E-Mail an das Sekretariat der Akademie "EduFuture". Klären Sie folgende Punkte:\n- Genaue Termine und Uhrzeiten (Abend- oder Wochenendkurse)\n- Anerkennung des Zertifikats (z.B. PMI oder Scrum Alliance)\n- Kosten und Förderungsmöglichkeiten (z.B. Bildungsgutschein)\n- Voraussetzungen für die Teilnahme an der Abschlussprüfung',
    type: 'Information'
  },
  {
    id: 'default-15',
    title: 'Bewerbung: Aushilfe im Fitnessstudio',
    situation: 'Das Fitnessstudio "Fit&Fun" in Ihrer Stadt sucht eine studentische Aushilfe (m/w/d) für die Anmeldung, die Getränkebar und die gelegentliche Betreuung der Trainingsfläche am Wochenende.',
    content: 'Schreiben Sie Ihre Bewerbung an den Studioleiter Herrn Müller. Behandeln Sie folgende Punkte:\n- Bezugnahme auf die Ausschreibung und Grund der Bewerbung\n- Ihre persönliche Sportbegeisterung und Fitnesskenntnisse\n- Erfahrungen im Umgang mit Kunden und Servicebereitschaft\n- Ihre zeitliche Verfügbarkeit am Wochenende\n- Ihr gewünschter Arbeitsbeginn',
    type: 'Bewerbung'
  },
  {
    id: 'default-16',
    title: 'Beschwerde: Online-Möbelbestellung',
    situation: 'Sie haben beim Online-Möbelhaus "WoodStyle" ein hochwertiges Ecksofa aus Echtleder bestellt. Die Lieferzeit sollte maximal 10 Werktage betragen. Das Sofa kam erst nach 6 Wochen an. Zudem hat es die falsche Farbe (Dunkelblau statt Cognac-Braun) und an der Rückseite befindet sich ein auffälliger Riss im Leder.',
    content: 'Schreiben Sie eine Beschwerde an den Kundenservice von "WoodStyle". Behandeln Sie folgende Punkte:\n- Grund und Bestelldaten des Schreibens\n- Kritik an der extremen Lieferverzögerung\n- Beschreibung der Mängel (Farbe, Lederriss)\n- Forderung auf Umtausch oder einen erheblichen Preisnachlass\n- Frist für die Rückmeldung',
    type: 'Beschwerde'
  },
  {
    id: 'default-17',
    title: 'Bitte um Infos: Veganes Catering für Firmenfeier',
    situation: 'Sie organisieren das jährliche Sommerfest für Ihr Unternehmen mit ca. 80 Mitarbeitern. Die Geschäftsleitung wünscht dieses Jahr ein vollständig veganes und nachhaltiges Speisenangebot. Sie interessieren sich für die Dienste von "Green Catering Hamburg".',
    content: 'Schreiben Sie eine Anfrage-E-Mail an das Catering-Team. Klären Sie folgende Punkte:\n- Vorschläge für ein veganes Buffet (Vorspeisen, Hauptspeisen, Desserts)\n- Berücksichtigung von weiteren Unverträglichkeiten (z.B. glutenfrei)\n- Bereitstellung von Geschirr, Besteck und Servicepersonal vor Ort\n- Preiskalkulation pro Person und Lieferbedingungen',
    type: 'Information'
  },
  {
    id: 'default-18',
    title: 'Bewerbung: Hundesitter in München',
    situation: 'Die Agentur "Paws & Friends" vermittelt qualifizierte und liebevolle Tierbetreuer an Hundebesitzer in München, die tagsüber arbeiten. Gesucht werden tierbegeisterte Menschen für Spaziergänge und Tagesbetreuung.',
    content: 'Schreiben Sie Ihre Bewerbung für die Aufnahme in die Betreuerkartei. Behandeln Sie folgende Punkte:\n- Motivation für die Arbeit als Hundesitter\n- Bisherige eigene Erfahrungen im Umgang mit Hunden (Rassen, Verhalten)\n- Zuverlässigkeit und Verhalten in stressigen oder unvorhergesehenen Situationen\n- Raumverhältnisse (Wohnung, Nähe zu Parks)\n- Ihre zeitliche Verfügbarkeit unter der Woche',
    type: 'Bewerbung'
  },
  {
    id: 'default-19',
    title: 'Beschwerde: Premium-Essenslieferdienst',
    situation: 'Sie haben für einen Jahrestag ein festliches Drei-Gänge-Menü für vier Personen beim Premium-Lieferdienst "GourmetExpress" bestellt. Gegen Aufpreis wurde eine minutengenaue Lieferung garantiert. Das Essen kam 90 Minuten zu spät, die Suppe war kalt und ausgelaufen, das Hauptgericht vertauscht (vegetarisch statt Rinderfilet) und das Dessert fehlte ganz.',
    content: 'Schreiben Sie eine Beschwerde an die Geschäftsführung von "GourmetExpress". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens und Bestelldetails\n- Massive Lieferverzögerung trotz kostenpflichtiger Garantie\n- Kritik an Verpackung, Temperatur und fehlerhafter Lieferung\n- Enttäuschung über den misslungenen festlichen Abend\n- Forderung nach vollständiger Erstattung des Preises',
    type: 'Beschwerde'
  },
  {
    id: 'default-20',
    title: 'Bitte um Infos: Sommercamp für Kinder',
    situation: 'Sie möchten Ihren 10-jährigen Sohn für ein zweiwöchiges "Natur- und Abenteuercamp" in Thüringen anmelden, welches vom Verein "WildnisKids e.V." veranstaltet wird. Es bleiben jedoch wesentliche organisatorische Fragen offen.',
    content: 'Schreiben Sie eine E-Mail an den Veranstalter "WildnisKids e.V.". Bitten Sie um Auskunft zu:\n- Betreuerschlüssel (Verhältnis Betreuer zu Kindern) und Qualifikationen\n- Tagesablauf, Aktivitäten und Sicherheitsvorkehrungen bei schlechtem Wetter\n- Unterkunft (Zelte oder feste Häuser) und Verpflegung (Allergene, vegetarisch)\n- Rücktrittsbedingungen bei plötzlicher Erkrankung des Kindes',
    type: 'Information'
  },
  {
    id: 'default-21',
    title: 'Bewerbung: Social Media Assistant',
    situation: 'Das zukunftsorientierte Mode-Startup "StyleInspo" aus Berlin sucht einen Social Media Assistant (m/w/d) auf Minijob-Basis (10-15 Stunden/Woche). Aufgaben umfassen die Erstellung von Inhalten für Instagram, TikTok und das Beantworten von Community-Fragen.',
    content: 'Schreiben Sie Ihre Bewerbung an die Marketingleitung. Gehen Sie auf folgende Punkte ein:\n- Ihre Begeisterung für Mode und Social-Media-Plattformen\n- Erfahrungen im Bereich Content Creation (Fotos, Videos, Reels, Canva etc.)\n- Ihre Kommunikationsstärke und Deutschkenntnisse im Umgang mit Followern\n- Warum Sie speziell für das Startup "StyleInspo" arbeiten möchten\n- Ihre wöchentliche Verfügbarkeit und technisches Equipment',
    type: 'Bewerbung'
  },
  {
    id: 'default-22',
    title: 'Beschwerde: Konzertreise nach Hamburg',
    situation: 'Sie haben beim Reisebüro "KulturReisen" ein Paket gebucht, bestehend aus einer Hotelübernachtung in Hamburg und erstklassigen Eintrittskarten für ein Konzert in der Elbphilharmonie. Die Eintrittskarten wurden Ihnen trotz Zusage nicht ins Hotel geliefert, weshalb Sie das Konzert verpassten. Zudem war das Hotelzimmer schmutzig und laut.',
    content: 'Schreiben Sie eine Beschwerde an das Reisebüro "KulturReisen". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens und Buchungsnummer\n- Nichtzustellung der Konzertkarten und das verpasste Event\n- Mängel des Hotelzimmers (Lärm, Hygiene)\n- Enttäuschung über den zerstörten Wochenendausflug\n- Forderung auf vollständige Erstattung des Reisepreises und Schadensersatz',
    type: 'Beschwerde'
  },
  {
    id: 'default-23',
    title: 'Bitte um Infos: Coworking Space Mitgliedschaft',
    situation: 'Sie arbeiten als freiberuflicher Softwareentwickler im Homeoffice und möchten ein professionelles Arbeitsumfeld nutzen. Sie interessieren sich für ein monatliches Abonnement im Coworking Center "Nexus Office" in Frankfurt.',
    content: 'Schreiben Sie eine E-Mail an die Centerleitung. Erkundigen Sie sich nach folgenden Punkten:\n- Unterschied zwischen "Flex Desk" (freier Tischwechsel) und "Dedicated Desk" (fester Arbeitsplatz)\n- Technische Infrastruktur (Internet-Geschwindigkeit, Druckernutzung, Kaffeeküche)\n- Zugangsmöglichkeiten am Wochenende und zu späten Abendstunden (Keycard)\n- Buchbarkeit von Meetingräumen für Kundentermine und Preisvorteile für Mitglieder',
    type: 'Information'
  },
  {
    id: 'default-24',
    title: 'Bewerbung: Kellner im italienischen Restaurant',
    situation: 'Das Restaurant "Bella Italia" in Köln sucht für die abendlichen Stoßzeiten und das Wochenende eine engagierte Servicekraft (m/w/d). Erfahrungen im Service sind gewünscht, aber keine zwingende Voraussetzung.',
    content: 'Schreiben Sie Ihre aussagekräftige Bewerbung an den Geschäftsführer Herrn Rossi. Behandeln Sie folgende Punkte:\n- Ihr Bezug zur Gastronomie und Grund der Bewerbung\n- Ihre Stärken im Servicebereich (Freundlichkeit, Stressresistenz, Teamfähigkeit)\n- Bisherige Tätigkeiten im Kundenkontakt oder in der Gastronomie\n- Ihre Sprachkenntnisse (Deutsch, Englisch, eventuell Italienisch)\n- Ihre zeitliche Flexibilität am Abend und am Wochenende',
    type: 'Bewerbung'
  },
  {
    id: 'default-25',
    title: 'Beschwerde: Fitnessstudio "VitalLife"',
    situation: 'Sie haben einen Jahresvertrag im Studio "VitalLife" unter der Bedingung abgeschlossen, dass Ihnen der Zutritt zum Saunabereich und die Teilnahme an Fitnesskursen jederzeit kostenlos zustehen. Seit drei Monaten ist die Sauna defekt. Außerdem wurden fast alle Pilates- und Yogakurse ohne Ersatz gestrichen. Trotzdem bucht das Studio den vollen Monatsbeitrag ab.',
    content: 'Schreiben Sie eine Beschwerde an den Kundenservice von "VitalLife". Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens und Mitgliedsnummer\n- Dauerhafter Ausfall des Saunabereichs und mangelnde Reparatur\n- Streichung der vertraglich vereinbarten Kurse\n- Forderung einer angemessenen Beitragsminderung für die Ausfallzeit\n- Fristsetzung zur Lösung oder Androhung einer außerordentlichen Kündigung',
    type: 'Beschwerde'
  },
  {
    id: 'default-26',
    title: 'Bitte um Infos: Deutschprüfungen für Mediziner',
    situation: 'Sie haben ein abgeschlossenes Medizinstudium im Ausland absolviert und möchten bald als Assistenzarzt in Deutschland arbeiten. Zur Beantragung der Approbation benötigen Sie die Fachsprachenprüfung (FSP). Sie interessieren sich für die Vorbereitungskurse des Anbieters "Med-Deutsch Akademie".',
    content: 'Schreiben Sie eine Anfrage-E-Mail an die Kursleitung der "Med-Deutsch Akademie". Fragen Sie nach:\n- Dauer, Startterminen und Preisen des speziellen FSP-Zertifikatskurses\n- Lerninhalten (Patientengespräche, Arztbriefe, medizinische Dokumentation)\n- Qualifikationen der Dozenten (Mediziner oder zertifizierte Sprachlehrer)\n- Möglichkeit eines Online- oder Hybridkurses und Bestehensquote der Teilnehmer',
    type: 'Information'
  },
  {
    id: 'default-27',
    title: 'Bewerbung: Mitarbeiter im Kundendienst',
    situation: 'Das E-Commerce-Unternehmen "EcoCart" vertreibt ökologische Haushaltswaren und sucht ab sofort Mitarbeiter (m/w/d) im Kundenservice für die schriftliche und telefonische Kundenbetreuung, vollständig im Homeoffice (Remote).',
    content: 'Schreiben Sie Ihre Bewerbung an die Personalabteilung von "EcoCart". Gehen Sie auf folgende Punkte ein:\n- Grund der Bewerbung und Ihre Identifikation mit ökologischen Produkten\n- Ihre Stärken in der schriftlichen und mündlichen Kommunikation (Freundlichkeit, Geduld)\n- Ihre Erfahrungen mit PC-Arbeit, Kundensystemen oder Office-Paketen\n- Ihr eingerichteter, ungestörter Heimarbeitsplatz mit stabiler Internetverbindung\n- Ihre Gehaltsvorstellung (Stundenlohn) und gewünschte Wochenarbeitszeit',
    type: 'Bewerbung'
  },
  {
    id: 'default-28',
    title: 'Beschwerde: Hotelaufenthalt "Seeblick"',
    situation: 'Sie haben für einen Erholungsurlaub ein Doppelzimmer mit Seeblick im Hotel "Seeblick" reserviert. Bei Ihrer Ankunft teilte man Ihnen mit, dass das Hotel überbucht sei. Sie mussten in ein kleineres Zimmer im Souterrain direkt neben der lauten Heizungsanlage umziehen. Der versprochene Seeblick fehlte, und das Frühstücksbuffet war ungenießbar.',
    content: 'Schreiben Sie eine Beschwerde an die Hoteldirektion. Behandeln Sie folgende Punkte:\n- Grund Ihres Schreibens und Buchungszeitraum\n- Kritik an der Überbuchung und der minderwertigen Ersatzunterkunft\n- Lärmbelästigung durch die Heizung und fehlende Erholung\n- Mangelnde Qualität der Verpflegung (Frühstück)\n- Forderung auf Rückerstattung der Preisdifferenz und angemessene Entschädigung',
    type: 'Beschwerde'
  },
  {
    id: 'default-29',
    title: 'Bitte um Infos: Kletterpark Teambuilding',
    situation: 'Sie sind Abteilungsleiter in einer IT-Firma mit 25 Mitarbeitern. Zur Stärkung des Teamgeists planen Sie einen Betriebsausflug in den "Abenteuer-Kletterwald Taunus". Sie möchten ein maßgeschneidertes Teambuilding-Programm buchen.',
    content: 'Schreiben Sie eine Anfrage an das Event-Team des Kletterwalds. Klären Sie folgende Punkte:\n- Spezielle Gruppen- und Teambuilding-Aktivitäten mit Trainerbegleitung\n- Sicherheitskonzept, notwendige Kleidung und Einweisung für Anfänger\n- Catering-Optionen (Grillplatz mieten, Catering-Service oder Restaurant vor Ort)\n- Gruppenrabatte und Stornierungsbedingungen bei starkem Regen',
    type: 'Information'
  },
  {
    id: 'default-30',
    title: 'Bewerbung: Event-Aushilfe auf Musikmesse',
    situation: 'Für die internationale Musikmesse "Musicon" in Frankfurt sucht der Veranstalter "MesseFrankfurt GmbH" kurzfristig zweisprachige Event-Aushilfen (m/w/d) für die Besucherregistrierung, Wegeleitung und Informationsstände.',
    content: 'Schreiben Sie Ihre Bewerbung für diesen Messejob. Behandeln Sie folgende Punkte:\n- Bezug auf die Stellenausschreibung und Motivation für die Mitarbeit auf der Musikmesse\n- Ihre Sprachkenntnisse (Deutsch, Englisch fließend, weitere Sprachen)\n- Ihre Kontaktfreudigkeit, Belastbarkeit bei hohem Besucheraufkommen und gepflegtes Auftreten\n- Erfahrungen aus früheren Messen, Promotionjobs oder dem Kundenservice\n- Bestätigung Ihrer uneingeschränkten Zugänglichkeit an allen vier Messetagen',
    type: 'Bewerbung'
  },
  {
    id: 'default-31',
    title: 'Beschwerde: Streamingdienst Abo-Abrechnung',
    situation: 'Sie nutzen seit einem Jahr den Streamingdienst "MoviePlus". Vor kurzem wurde ohne Ihre Zustimmung der Paketpreis um 50 % erhöht. Zudem wurde Ihnen trotz fristgerechter Kündigung des Premium-Zusatzpakets der Betrag für drei weitere Monate abgebucht. Der telefonische Support hat Ihr Anliegen ignoriert.',
    content: 'Schreiben Sie eine formelle Beschwerde an den Kundenservice von "MoviePlus". Behandeln Sie folgende Punkte:\n- Grund des Schreibens, Kundennummer und Vertragsdaten\n- Kritik an der unangekündigten Preiserhöhung\n- Rechtswidrige Abbuchung trotz nachweisbar fristgerechter Kündigung\n- Enttäuschung über die Servicequalität und Untätigkeit des telefonischen Supports\n- Forderung zur sofortigen Rücküberweisung des fälschlicherweise eingezogenen Geldes',
    type: 'Beschwerde'
  },
  {
    id: 'default-32',
    title: 'Bitte um Infos: Auslandssemester in Heidelberg',
    situation: 'Sie studieren Germanistik in Ihrem Heimatland und möchten im nächsten Frühjahr ein einsemestriges Erasmus-Auslandsstudium an der Universität Heidelberg absolvieren. Viele administrative Schritte sind noch unklar.',
    content: 'Schreiben Sie eine E-Mail an das Akademische Auslandsamt (AAA) der Universität Heidelberg. Fragen Sie nach:\n- Fristen für die Einreichung der Zulassungsunterlagen und Anerkennung von bisherigen Noten\n- Unterstützung bei der Vermittlung eines Zimmers in einem staatlichen Studentenwohnheim\n- Angebot von fachbegleitenden Deutschkursen für ausländische Studenten vor Semesterbeginn\n- Orientierungsangebote (Buddy-Programm, Einführungsveranstaltungen)',
    type: 'Information'
  },
  {
    id: 'default-33',
    title: 'Bewerbung: Werkstudent im IT-Support',
    situation: 'Das Software-Unternehmen "NetSolutions" in Stuttgart sucht einen Werkstudenten (m/w/d) für den hausinternen IT-Support und die Pflege der Netzwerksicherheit (16-20 Std./Woche).',
    content: 'Schreiben Sie ein aussagekräftiges Bewerbungsschreiben. Gehen Sie auf folgende Punkte ein:\n- Bezugnahme auf das Stellenangebot und Grund Ihrer Bewerbung\n- Ihr Studiengang (Informatik, Wirtschaftsinformatik o.Ä.) und aktuelles Semester\n- Praktische Kenntnisse in Betriebssystemen, Netzwerken, Hardware-Fehleranalyse\n- Ihre Arbeitsweise (selbstständig, zielstrebig, teamorientiert)\n- Ihre zeitliche Verfügbarkeit unter der Woche (Abstimmung mit Vorlesungszeiten)',
    type: 'Bewerbung'
  },
  {
    id: 'default-34',
    title: 'Beschwerde: Erlebnis-Gutschein "Ballonfahrt"',
    situation: 'Sie bekamen von Freunden einen Erlebnis-Gutschein für eine "Exklusive Ballonfahrt bei Sonnenaufgang über dem Bodensee mit Champagner-Picknick" von der Agentur "SkyAdventures". Der Termin wurde viermal wegen Kleinigkeiten abgesagt. Als die Fahrt stattfand, war es mittags, es ging über ein unschönes Industriegebiet, es gab 12 statt 2 Mitflieger und statt Champagner gab es Apfelschorle.',
    content: 'Schreiben Sie eine Beschwerde an die Zentrale von "SkyAdventures". Behandeln Sie folgende Punkte:\n- Grund des Schreibens und Gutschein-Nummer\n- Ärger über die extrem komplizierte und unkooperative Terminfindung\n- Abweichung der Realität vom Gutscheintext (Tageszeit, Route, Teilnehmerzahl)\n- Enttäuschung über das lieblose Picknick ohne versprochenen Champagner\n- Forderung auf teilweise Rückerstattung des Gutscheinwertes in bar',
    type: 'Beschwerde'
  },
  {
    id: 'default-35',
    title: 'Bitte um Infos: Franchise-Konzept Eröffnung',
    situation: 'Sie planen die Eröffnung eines eigenen, gesunden Bistros und interessieren sich sehr für das erfolgreiche vegane Franchise-Konzept von "BioSalad Organics". Sie verfügen über etwas Startkapital und gastronomische Erfahrung.',
    content: 'Schreiben Sie eine E-Mail an die Franchise-Zentrale der "BioSalad Organics GmbH". Klären Sie folgende Punkte:\n- Voraussetzungen (Eigenkapital, berufliche Qualifikationen, Standortbedingungen)\n- Struktur der Franchise-Gebühren (Einstiegsgebühr, monatliche Umsatzbeteiligung)\n- Unterstützung beim Marketing, Ladendesign, der Lieferkette und Mitarbeiterschulung\n- Zusendung von ausführlichem Informationsmaterial und Ablauf einer Bewerbung als Partner',
    type: 'Information'
  },
  {
    id: 'default-36',
    title: 'Bewerbung: Stadtführer in Berlin',
    situation: 'Die Tourismus-Agentur "BerlinExplorer" sucht für Stadtrundgänge sowie geführte Fahrradtouren durch Berlin-Mitte und Kreuzberg enthusiastische, offene und ortskundige Stadtführer (m/w/d) für die Wochenenden.',
    content: 'Schreiben Sie Ihre Bewerbung als Stadtführer an den Personalverantwortlichen. Behandeln Sie folgende Punkte:\n- Warum Sie Stadtführer in Berlin werden möchten und Ihre Verbindung zur Stadt\n- Ihre Ortskenntnisse in Berlin (Geschichte, Kultur, Geheimtipps)\n- Ihre Fremdsprachenkenntnisse (Deutsch verhandlungssicher, weitere Sprachen von Vorteil)\n- Erfahrungen im Vortragen vor größeren Gruppen (Präsentationen, offene Art)\n- Ihre zeitliche Verfügbarkeit am Wochenende und sportliche Fitness (Fahrradtouren)',
    type: 'Bewerbung'
  },
  {
    id: 'default-37',
    title: 'Beschwerde: Online-Fotobuch Druckfehler',
    situation: 'Sie haben über das Portal "PixPrint" ein hochwertiges, teures Hardcover-Fotobuch mit 100 Seiten als Geschenk für die Goldene Hochzeit Ihrer Großeltern bestellt. Bei der Lieferung stellten Sie fest: Der Bucheinband ist schief aufgeklebt, die Farben sind extrem dunkel und verwaschen, und auf 5 Seiten fehlt der gedruckte Text komplett, obwohl er im Vorschau-Editor korrekt angezeigt wurde.',
    content: 'Schreiben Sie eine Beschwerde an die Reklamationsabteilung von "PixPrint". Behandeln Sie folgende Punkte:\n- Grund des Schreibens, Kundennummer und Bestell-ID\n- Beschreibung der gravierenden Fehldrucke und Qualitätsmängel (Farbe, Einband)\n- Nicht-Abdruck der Texte als schwerer Mangel\n- Verlust des geplanten Geschenks und zeitlicher Druck wegen des Hochzeitstags\n- Forderung auf kostenlosen Neudruck innerhalb von 5 Tagen oder Erstattung der Kosten mit Entschädigung',
    type: 'Beschwerde'
  },
  {
    id: 'default-38',
    title: 'Bitte um Infos: Mitgliedschaft im Tennisclub',
    situation: 'Sie sind vor Kurzem in eine neue Stadt gezogen und möchten einem lokalen Tennisclub beitreten, um aktiv Sport zu treiben und Kontakte zu knüpfen. Sie sind am "Tennis-Club Rot-Weiß" interessiert.',
    content: 'Schreiben Sie eine E-Mail an den Vorstand des Tennis-Clubs. Erkundigen Sie sich nach:\n- Aufnahmegebühr und monatlichem/jährlichem Mitgliedsbeitrag (Ermäßigung für Studenten/Familien)\n- Ausstattung des Clubs (Anzahl der Außen- und Hallenplätze, Buchungssystem für Spielfelder)\n- Trainingsmöglichkeiten für Erwachsene (Gruppentraining mit professionellem Trainer, Spielstärkeneinstufung)\n- Clubleben, Turnieren für Freizeitsportler und Kennenlern-Treffs für neue Mitglieder',
    type: 'Information'
  },
  {
    id: 'default-39',
    title: 'Bewerbung: Rezeptionist in Jugendherberge',
    situation: 'Die Jugendherberge "CityHostel Dresden" sucht ab der kommenden Frühjahrssaison einen Rezeptionisten (m/w/d) in Teilzeit (20 Stunden/Woke) zur Betreuung internationaler Backpacker, Check-in/Check-out und Organisation kleiner Events.',
    content: 'Schreiben Sie Ihre Bewerbung für das CityHostel. Behandeln Sie folgende Punkte:\n- Ihre Motivation, in einem lebhaften, internationalen Hostel zu arbeiten\n- Erste Erfahrungen im Beherbergungsgewerbe oder im engen Kundenkontakt\n- Ausgeprägte Sprachkenntnisse (Deutsch verhandlungssicher, Englisch fließend, weitere Sprachen)\n- Ihre Computerkenntnisse (E-Mail, Buchungssoftware, Social Media)\n- Flexibilität bei Schichtarbeit (Früh-, Spät- und gelegentliche Wochenendschichten)',
    type: 'Bewerbung'
  }
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>(() => {
    const saved = localStorage.getItem('dia_exercises');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.length > 0) {
        const combined = [...parsed];
        DEFAULT_EXERCISES.forEach(def => {
          if (!combined.some(c => c.id === def.id)) {
            combined.push(def);
          }
        });
        return combined;
      }
    }
    return DEFAULT_EXERCISES;
  });
  const [progress, setProgress] = useState<Record<string, SavedProgress>>(() => {
    const saved = localStorage.getItem('dia_progress');
    return saved ? JSON.parse(saved) : {};
  });
  
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Email login/signup states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [emailRole, setEmailRole] = useState<'student' | 'teacher'>('student');
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [teacherCode, setTeacherCode] = useState('');

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      alert("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    if (isSignUp && !fullName) {
      alert("Veuillez saisir votre nom complet.");
      return;
    }
    if (isSignUp && emailRole === 'teacher' && teacherCode.trim().toUpperCase() !== 'B2PROF') {
      alert("Le code d'accès enseignant est incorrect. Veuillez utiliser le bon code pour créer un compte Prof (Ex: B2PROF).");
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, fullName, emailRole);
      } else {
        await loginWithEmail(email, password);
      }
      // Reset form on success
      setEmail('');
      setPassword('');
      setFullName('');
      setTeacherCode('');
      setShowEmailForm(false);
    } catch (err: any) {
      console.error(err);
    } finally {
      setAuthLoading(false);
    }
  };

  // Sync Auth & Profile
  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
      
      // Cleanup previous profile listener
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      if (u) {
        const profileRef = doc(db, 'users', u.uid);
        unsubscribeProfile = onSnapshot(profileRef, (snap) => {
          if (snap.exists()) {
            setUserProfile(snap.data());
          } else {
            console.log("No profile found in Firestore for uid:", u.uid, ". Using local auth data as fallback...");
            const fallbackProfile = {
              uid: u.uid,
              email: u.email || '',
              displayName: u.displayName || u.email?.split('@')[0] || 'Utilisateur',
              photoURL: u.photoURL || null,
              role: 'student' as const,
              createdAt: new Date()
            };
            setUserProfile(fallbackProfile);
          }
        }, (err) => {
          console.error("Profile sync error:", err);
          handleFirestoreError(err, OperationType.GET, `users/${u.uid}`);
        });
      } else {
        setUserProfile(null);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  // Fetch Teachers
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: any[] = [];
      snapshot.forEach(doc => list.push(doc.data()));
      setTeachers(list);
    });
    return () => unsubscribe();
  }, [user]);

  // Sync exercises from global collection
  useEffect(() => {
    const q = query(collection(db, 'exercises'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const cloudExercises: Exercise[] = [];
      snapshot.forEach((doc) => {
        cloudExercises.push(doc.data() as Exercise);
      });
      
      setExercises(prev => {
        const combined = [...cloudExercises];
        
        // Ensure defaults are present
        DEFAULT_EXERCISES.forEach(def => {
          if (!combined.find(c => c.id === def.id)) {
            combined.push(def);
          }
        });

        // Keep local manual uploads that haven't hit the cloud yet
        prev.forEach(ex => {
          if (!combined.find(c => c.id === ex.id)) {
            combined.push(ex);
          }
        });

        return combined;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'exercises');
    });

    return () => unsubscribe();
  }, []);

  // Sync progress from Firestore (restore only finished/evaluated exercises)
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(collection(db, 'users', user.uid, 'progress'), (snapshot) => {
      const cloudProgress: Record<string, SavedProgress> = {};
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Only load if evaluation exists (uncompleted drafts must not be loaded/restored)
        if (data.evaluation) {
          cloudProgress[doc.id] = {
            text: data.text,
            evaluation: data.evaluation
          };
        }
      });
      
      setProgress(prev => {
        // Build a state where we overwrite/populate with cloud completed evaluations 
        const updated = { ...prev };
        Object.entries(cloudProgress).forEach(([id, val]) => {
          updated[id] = val;
        });
        return updated;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/progress`);
    });

    return () => unsubscribe();
  }, [user]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const selectExercise = async (id: string | null, forceUploadView = false) => {
    // Check if the current exercise has written text without evaluation (volatile draft)
    const activeProgress = selectedId ? progress[selectedId] : null;
    const hasUnsavedDraft = activeProgress && !activeProgress.evaluation && ((activeProgress.text && activeProgress.text.trim().length > 0) || isTimerRunning);

    if (hasUnsavedDraft) {
      if (!confirm("Attention : Votre rédaction en cours n'a pas été évaluée et sera PERDUE si vous quittez ou changez de sujet. Voulez-vous continuer ?")) {
        return;
      }
      // Immediately clear the volatile draft from state
      setProgress(prev => {
        const updated = { ...prev };
        delete updated[selectedId!];
        return updated;
      });
    }

    setSelectedId(id);
    setIsUploading(forceUploadView);
    setIsSidebarOpen(false);
    setIsTimerRunning(false); // Reset timer active state on exercise swap
  };

  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const activeProgress = selectedId ? progress[selectedId] : null;
      const hasUnsavedDraft = activeProgress && !activeProgress.evaluation && ((activeProgress.text && activeProgress.text.trim().length > 0) || isTimerRunning);
      
      if (hasUnsavedDraft) {
        e.preventDefault();
        e.returnValue = "Attention : Votre rédaction en cours n'a pas été évaluée et sera perdue si vous fermez l'application.";
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [selectedId, progress, isTimerRunning]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('dia_exercises', JSON.stringify(exercises));
  }, [exercises]);

  useEffect(() => {
    // Only save progress to localStorage if it has an evaluation!
    const cleanProgress: Record<string, SavedProgress> = {};
    for (const [id, value] of Object.entries(progress)) {
      if (value.evaluation) {
        cleanProgress[id] = value;
      }
    }
    localStorage.setItem('dia_progress', JSON.stringify(cleanProgress));
  }, [progress]);

  // Synchronise local custom exercises to Firestore upon login
  useEffect(() => {
    if (!user) return;
    
    const syncLocalExercises = async () => {
      const customLocalExercises = exercises.filter(ex => !ex.id.startsWith('default-'));
      for (const ex of customLocalExercises) {
        // Sanitize first to protect against ID/keys firestore rules
        const cleanId = ex.id.replace(new RegExp("[^a-zA-Z0-9_\\-]", "g"), '_').substring(0, 100) || `ex_${Date.now()}`;
        try {
          const exRef = doc(db, 'exercises', cleanId);
          await setDoc(exRef, {
            id: cleanId,
            title: ex.title || 'Sujet sans titre',
            situation: ex.situation || '',
            content: ex.content || '',
            type: ex.type || 'Beschwerde',
            createdAt: serverTimestamp()
          }, { merge: true });
        } catch (err) {
          console.warn("Silent sync error for exercise:", cleanId, err);
        }
      }
    };

    // Run sync after a brief delay to avoid race conditions
    const timer = setTimeout(() => {
      syncLocalExercises();
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, exercises]);

  const handleUpload = useCallback(async (fileData: string, mimeType: string) => {
    setIsExtracting(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante.");
      }
      const extracted = await extractExercises(fileData, mimeType);
      
      // Filter out duplicates within the newly extracted
      const uniqueExtracted = extracted.filter((ex, index, self) => 
        index === self.findIndex((t) => t.title === ex.title && t.situation === ex.situation)
      );

      // Filter against existing exercises to prevent duplicates
      const newExercises = uniqueExtracted.filter(ex => 
        !exercises.some(p => p.title === ex.title && p.situation === ex.situation)
      );
      
      const sanitizedExtracted = newExercises.map(ex => {
        const cleanId = `ex_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        return {
          id: cleanId,
          title: ex.title || 'Sujet sans titre',
          situation: ex.situation || '',
          content: ex.content || '',
          type: ex.type || 'Beschwerde'
        };
      });

      // Save to global exercises if logged in
      if (user && sanitizedExtracted.length > 0) {
        for (const ex of sanitizedExtracted) {
          const exRef = doc(db, 'exercises', ex.id);
          await setDoc(exRef, {
            id: ex.id,
            title: ex.title,
            situation: ex.situation,
            content: ex.content,
            type: ex.type,
            createdAt: serverTimestamp()
          });
        }
      }

      if (sanitizedExtracted.length > 0) {
        setExercises(prev => [...sanitizedExtracted, ...prev]);
        setSelectedId(sanitizedExtracted[0].id);
      } else if (extracted.length > 0) {
        // Find an existing one that matches what was extracted
        const existing = exercises.find(p => p.title === extracted[0].title && p.situation === extracted[0].situation);
        if (existing) {
          setSelectedId(existing.id);
        }
        alert("Les sujets trouvés dans ce document existent déjà dans l'application.");
      } else {
        alert("Aucun exercice n'a été trouvé dans ce document.");
      }
      
      setIsUploading(false);
    } catch (error: any) {
      console.error(error);
      alert(`Erreur lors de l'extraction: ${error.message || "Erreur inconnue"}`);
    } finally {
      setIsExtracting(false);
    }
  }, [user, exercises]);

  const handleTextChange = useCallback((id: string, text: string) => {
    // Only update state in temporary/volatile memory for typing feedback
    setProgress(prev => {
      if (prev[id]?.text === text) return prev;
      return {
        ...prev,
        [id]: { ...(prev[id] || { evaluation: null }), text }
      };
    });
  }, []);

  const handleEvaluate = useCallback(async (id: string, text: string) => {
    const exercise = exercises.find(e => e.id === id);
    if (!exercise) return;
    
    setIsEvaluating(true);
    try {
      if (!process.env.GEMINI_API_KEY) {
        throw new Error("La clé API Gemini (GEMINI_API_KEY) est manquante.");
      }
      const result = await evaluateWriting(exercise, text);
      
      // Save to Firestore if logged in
      if (user) {
        const progRef = doc(db, 'users', user.uid, 'progress', id);
        await setDoc(progRef, {
          exerciseId: id,
          text,
          evaluation: result,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }

      setProgress(prev => ({
        ...prev,
        [id]: { text, evaluation: result }
      }));
    } catch (error: any) {
      console.error(error);
      alert(`Erreur lors de l'évaluation: ${error.message || "Erreur inconnue"}`);
    } finally {
      setIsEvaluating(false);
    }
  }, [exercises, user]);

  const sortedExercises = useMemo(() => {
    return [...exercises].sort((a, b) => {
      const isDefaultA = a.id.startsWith('default-');
      const isDefaultB = b.id.startsWith('default-');

      if (isDefaultA && isDefaultB) {
        const numA = parseInt(a.id.replace('default-', ''), 10);
        const numB = parseInt(b.id.replace('default-', ''), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB;
        }
        return a.id.localeCompare(b.id);
      }
      
      if (isDefaultA && !isDefaultB) return -1;
      if (!isDefaultA && isDefaultB) return 1;

      // Custom ones: sort alphabetically by title, then clean ID
      const titleCompare = (a.title || '').localeCompare(b.title || '');
      if (titleCompare !== 0) return titleCompare;
      return a.id.localeCompare(b.id);
    });
  }, [exercises]);

  const filteredExercises = useMemo(() => {
    return sortedExercises.filter(ex => 
      ex.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
      ex.type.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sortedExercises, searchTerm]);

  const selectedExercise = sortedExercises.find(e => e.id === selectedId);
  const currentProgress = selectedId ? progress[selectedId] : null;

  // Memoize handlers that depend on the selected exercise id to prevent infinite loops in TrainingInterface
  const onTextChange = useMemo(() => {
    if (!selectedId) return () => {};
    return (text: string) => handleTextChange(selectedId, text);
  }, [selectedId, handleTextChange]);

  const onEvaluate = useMemo(() => {
    if (!selectedId) return () => {};
    return (text: string) => handleEvaluate(selectedId, text);
  }, [selectedId, handleEvaluate]);

  return (
    <div className="flex flex-col h-[100dvh] bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-500 text-white px-4 py-2 text-sm font-medium flex items-center justify-center gap-2 shrink-0">
          <WifiOff className="w-4 h-4" />
          Mode hors-ligne actif. Vous pouvez continuer à écrire, mais l'extraction et l'évaluation nécessitent une connexion.
        </div>
      )}

      {/* Mobile Header Banner */}
      <div className="md:hidden relative z-30 flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setIsSidebarOpen(true)}
          className="p-1.5 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          aria-label="Ouvrir le menu"
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="font-bold text-sm tracking-widest text-[#FF0000]">Schreiben</span>
        <div className="w-9" />
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Sidebar backdrop for mobile */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 w-4/5 max-w-[320px] md:w-80 md:max-w-none border-r border-gray-200 dark:border-gray-800 flex flex-col bg-gray-50 dark:bg-gray-900 z-50 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 md:relative md:flex transition-transform duration-300 ease-in-out shrink-0`}>
          <div className="p-6 border-b border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold tracking-tight text-[#FF0000]">Schreiben</h1>
              <button 
                onClick={() => setIsSidebarOpen(false)}
                className="md:hidden p-1.5 rounded-lg text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
                aria-label="Fermer le menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* User Session and Cloud Sync */}
            <div className="mb-6">
              {user ? (
                <div className="p-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                      {user.photoURL ? (
                        <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <UserIcon className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate leading-none mb-1">{user.displayName || 'Utilisateur'}</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Cloud className="w-2 h-2" /> {userProfile?.role === 'teacher' ? 'Enseignant' : 'Étudiant'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Role Switcher */}
                  <div className="mb-3">
                    {userProfile?.role === 'teacher' ? (
                      <button 
                        onClick={() => user && updateUserRole(user.uid, 'student')}
                        className="w-full py-1.5 px-3 rounded-lg text-[10px] font-bold bg-gray-100 dark:bg-gray-700 text-gray-750 hover:bg-[#FF0000] hover:text-white transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" /> Basculer en vue Étudiant
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          if (user) {
                            const code = prompt("Veuillez saisir le code d'accès enseignant pour activer le rôle de 'Prof' :");
                            if (code === null) return;
                            if (code.trim().toUpperCase() === "B2PROF") {
                              updateUserRole(user.uid, 'teacher');
                              alert("Rôle Enseignant activé !");
                            } else {
                              alert("Code d'accès enseignant incorrect.");
                            }
                          }
                        }}
                        className="w-full py-1 px-2 text-[9px] font-medium text-gray-400 hover:text-[#FF0000] hover:underline transition-all text-center"
                      >
                        ⚠️ Déverrouiller l'accès Enseignant
                      </button>
                    )}
                  </div>

                  <button 
                    onClick={logout}
                    className="w-full py-1.5 px-3 text-xs flex items-center justify-center gap-2 text-gray-500 hover:text-red-500 transition-colors border border-gray-100 dark:border-gray-700 rounded-lg"
                  >
                    <LogOut className="w-3 h-3" /> Déconnexion
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {!showEmailForm ? (
                    <div className="flex flex-col gap-3">
                      <button
                        onClick={loginWithGoogle}
                        className="w-full py-2 px-3 bg-[#FF0000] text-white rounded-lg hover:bg-red-600 transition-all active:scale-95 flex items-center justify-center gap-2 text-xs font-medium"
                      >
                        <LogIn className="w-3 h-3" />
                        Continuer avec Google
                      </button>
                      
                      <div className="flex items-center justify-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <button
                          onClick={() => { setShowEmailForm(true); setIsSignUp(false); }}
                          className="hover:text-gray-900 dark:hover:text-gray-100 hover:underline transition-colors"
                        >
                          Se connecter
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => { setShowEmailForm(true); setIsSignUp(true); }}
                          className="hover:text-gray-900 dark:hover:text-gray-100 hover:underline transition-colors"
                        >
                          Créer un compte
                        </button>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleEmailAuth} className="space-y-2.5 p-3.5 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm text-left">
                      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-700 pb-1.5">
                        <h3 className="text-[11px] font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wider">
                          {isSignUp ? "Créer un compte" : "Connexion Email"}
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowEmailForm(false)}
                          className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white underline font-medium"
                        >
                          Retour
                        </button>
                      </div>

                      {isSignUp && (
                        <div className="space-y-0.5">
                          <label className="text-[9px] uppercase font-bold text-gray-400 block">Nom complet</label>
                          <input
                            type="text"
                            className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-[#FF0000]"
                            placeholder="Ex: Victor Y."
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase font-bold text-gray-400 block">Email</label>
                        <input
                          type="email"
                          className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-[#FF0000]"
                          placeholder="exemple@email.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>

                      <div className="space-y-0.5">
                        <label className="text-[9px] uppercase font-bold text-gray-400 block">Mot de passe</label>
                        <input
                          type="password"
                          className="w-full text-xs p-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-[#FF0000]"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                      </div>

                      {isSignUp && (
                        <div className="space-y-1">
                          <label className="text-[9px] uppercase font-bold text-gray-400 block">Votre rôle</label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => setEmailRole('student')}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${emailRole === 'student' ? 'bg-[#FF0000] text-white border-transparent' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-250 dark:border-transparent'}`}
                            >
                              Élève
                            </button>
                            <button
                              type="button"
                              onClick={() => setEmailRole('teacher')}
                              className={`flex-1 py-1 rounded text-[10px] font-bold border transition-colors ${emailRole === 'teacher' ? 'bg-indigo-600 text-white border-transparent' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 border-gray-250 dark:border-transparent'}`}
                            >
                              Prof
                            </button>
                          </div>
                        </div>
                      )}

                      {isSignUp && emailRole === 'teacher' && (
                        <div className="space-y-0.5 animate-fadeIn">
                          <label className="text-[9px] uppercase font-bold text-amber-500 block">Code d'accès enseignant</label>
                          <input
                            type="text"
                            className="w-full text-xs p-2 border border-amber-300 dark:border-amber-700 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:border-indigo-600 font-mono"
                            placeholder="Entrez le code Prof (ex: B2PROF)"
                            value={teacherCode}
                            onChange={(e) => setTeacherCode(e.target.value)}
                            required
                          />
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-2 px-3 bg-[#FF0000] text-white rounded-lg font-bold text-xs hover:bg-red-600 disabled:opacity-50 transition-colors shadow-sm shadow-red-500/10"
                      >
                        {authLoading ? "En cours..." : isSignUp ? "S'inscrire et se connecter" : "Se connecter"}
                      </button>

                      <div className="text-center pt-1 border-t border-gray-100 dark:border-gray-700/50">
                        <button
                          type="button"
                          onClick={() => { setIsSignUp(!isSignUp); setPassword(''); }}
                          className="text-[10px] text-gray-500 hover:text-gray-900 dark:hover:text-white underline font-medium"
                        >
                          {isSignUp ? "Déjà membre ? Connectez-vous" : "Pas de compte ? Inscrivez-vous"}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>

            {!process.env.GEMINI_API_KEY ? (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-400">
                <div className="font-bold mb-1 flex items-center gap-1">
                  <WifiOff className="w-3 h-3" /> Clé API manquante
                </div>
                L'IA ne fonctionnera pas. Ajoutez <strong>GEMINI_API_KEY</strong> dans vos variables d'environnement.
              </div>
            ) : (
              <div className="mb-4 p-2 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-lg text-[10px] text-green-600 dark:text-green-400 flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                IA Connectée (Gemini 3.1 Pro)
              </div>
            )}

            <button
              onClick={() => selectExercise(null, true)}
              disabled={!isOnline}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer mb-4"
              title={!isOnline ? "Connexion internet requise" : ""}
            >
              <Plus className="w-4 h-4" />
              Ajouter un sujet
            </button>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-4 w-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Rechercher un sujet..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900 text-sm focus:outline-none focus:border-[#FF0000] focus:ring-1 focus:ring-[#FF0000] transition-colors"
              />
            </div>
            <InstallPWA />
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {filteredExercises.map(ex => {
              const prog = progress[ex.id];
              const isDone = !!prog?.evaluation;
              const hasStarted = !!prog?.text;
              
              return (
                <button
                  key={ex.id}
                  onClick={() => selectExercise(ex.id)}
                  className={
                    "w-full text-left p-4 rounded-xl border transition-all " +
                    (selectedId === ex.id && !isUploading
                      ? 'bg-white dark:bg-gray-800 border-[#FF0000] shadow-sm'
                      : 'bg-transparent border-transparent hover:bg-gray-200/50 dark:hover:bg-gray-800/50')
                  }
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold truncate text-sm">{ex.title}</h3>
                    {isDone ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                    ) : hasStarted ? (
                      <Clock className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-3">{ex.type}</p>
                  
                  {/* Progress Bar */}
                  <div className="h-1 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${isDone ? 'w-full bg-green-500' : hasStarted ? 'w-1/2 bg-orange-500' : 'w-0'}`}
                    />
                  </div>
                </button>
              );
            })}
            {filteredExercises.length === 0 && (
              <p className="text-sm text-gray-500 text-center mt-10">
                {sortedExercises.length === 0 ? "Aucun exercice sauvegardé." : "Aucun sujet trouvé."}
              </p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {userProfile?.role === 'teacher' ? (
            <TeacherDashboard />
          ) : isUploading ? (
            <div className="flex-1 overflow-y-auto flex items-center justify-center">
              <UploadSection onUpload={handleUpload} isExtracting={isExtracting} isOnline={isOnline} />
            </div>
          ) : selectedExercise ? (
            <TrainingInterface
              key={selectedExercise.id}
              exercise={selectedExercise}
              initialText={currentProgress?.text || ''}
              evaluation={currentProgress?.evaluation || null}
              onTextChange={onTextChange}
              onEvaluate={onEvaluate}
              isEvaluating={isEvaluating}
              isOnline={isOnline}
              isTimerRunning={isTimerRunning}
              setIsTimerRunning={setIsTimerRunning}
              teachers={teachers}
              user={user}
              lastTeacherId={userProfile?.lastTeacherId}
              onExit={() => selectExercise(null)}
            />
          ) : (
            <StudentDashboard
              exercises={sortedExercises}
              progress={progress}
              user={user}
              userProfile={userProfile}
              onSelectExercise={(id) => selectExercise(id)}
              onStartUpload={() => { setIsUploading(true); setSelectedId(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
