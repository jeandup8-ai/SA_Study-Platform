-- Afrikaans worked examples: translate the solution steps and final answers
-- that were still sitting in English.
--
-- An Afrikaans learner opened a lesson, read the worked problem in Afrikaans,
-- and then got the working-out and the answer in English. The problem text was
-- translated; the two fields below it were not. That is 109 final answers and
-- 119 solution-step lists across Mathematics, Life Skills, Creative Arts and
-- Social Sciences, Grades 4-7.
--
-- Left alone deliberately:
--   * Afrikaans FAL (15 lessons) -- the answer IS the Afrikaans sentence the
--     child must produce, so both columns holding it is correct.
--   * English Home Language (4 lessons) -- same reasoning, in English.
--   * Mathematics answers that are pure arithmetic (15 lessons, e.g. '192 / 8 = 24')
--     -- nothing in them is English.
--
-- Also corrects two errors found in the English while translating; see the
-- third statement.

-- Rows are matched on the first 8 characters of the lesson id, so fail loudly
-- if that is not unique.
do $$ begin
  if exists (
    select 1 from public.lessons group by substring(id::text, 1, 8) having count(*) > 1
  ) then
    raise exception 'lesson id prefix is not unique; this migration would hit the wrong rows';
  end if;
end $$;

-- 1. Afrikaans final answers.
with translated(prefix, final_answer) as (
  values
    ('ce60eca6', $af$125 ÷ 5 = 25, wat nie gelyk is aan 5 ÷ 125 nie.$af$::text),
    ('512c5074', $af$376 is 'n ewe getal, want sy laaste syfer, 6, is ewe.$af$::text),
    ('24619f72', $af$Die helfte van 168 is 84.$af$::text),
    ('8e43baf6', $af$4 is Duisendes (4 000), 3 is Honderdes (300), 7 is Tiene (70), 1 is Ene (1).$af$::text),
    ('ed261c6d', $af$8 is Duisendes, 4 is Honderdes, 5 is Tiene, 6 is Ene.$af$::text),
    ('8a9a9093', $af$(a), (c) en (d) is deel van hierdie eenheid; (b) is nie.$af$::text),
    ('44ff7f60', $af$120 ÷ 10 = 12, wat nie gelyk is aan 10 ÷ 120 nie.$af$::text),
    ('18518631', $af$Die volgende getal in die patroon is 20.$af$::text),
    ('4dffa9e8', $af$Die helfte van 168 is 84.$af$::text),
    ('26cc08ed', $af$Beweeg 2 blokkies na regs, van A1 na B1 na C1.$af$::text),
    ('a07cf1f8', $af$66 ÷ 8 = 8 res 2$af$::text),
    ('84fb1b40', $af$Die 7 staan in die Tienduisendes-kolom en is 70 000 werd.$af$::text),
    ('8ab128f5', $af$Dit is 'n rotasie.$af$::text),
    ('aee628a0', $af$Jy sal 'n reghoek (of vierkant) sien, afhangend van die vorm van die boks se basis.$af$::text),
    ('517ba1bb', $af$Graad 5 gebruik dieselfde strategieë as Graad 4, maar pas dit op groter getalle toe, soos deling deur 2-syfergetalle in plaas van 1-syfergetalle.$af$::text),
    ('89162381', $af$4 530 is deelbaar deur 2, 5 en 10.$af$::text),
    ('13f59e93', $af$324 ÷ 18 = 18, wat nie gelyk is aan 18 ÷ 324 nie.$af$::text),
    ('32c8a466', $af$Die plekwaarde van die 6 is Honderdduisendes; sy waarde is 600 000.$af$::text),
    ('d26ea738', $af$Dit is heel waarskynlik die sy-aansig.$af$::text),
    ('e04c42db', $af$Deelbaarheidsreëls (bv. vir 2, 5, 10, 100, 1 000) is nuut op hierdie vlak.$af$::text),
    ('8b108427', $af$Die reël is 3n (vermenigvuldig die posisienommer met 3).$af$::text),
    ('5d667be5', $af$12 + 7 = 7 + 12 = 19, wat die kommutatiewe eienskap bevestig.$af$::text),
    ('68aafbd6', $af$243 + 0 = 243, as gevolg van die identiteitseienskap van optelling.$af$::text),
    ('de110c32', $af$Varieer die vorms en groottes in die patroon om kontras te skep.$af$::text),
    ('c488bb82', $af$Groen.$af$::text),
    ('1ed0f5ec', $af$'n Tint van groen vir die blaar in die son, en 'n skakering van groen vir die blaar in die skaduwee.$af$::text),
    ('5b8b0a02', $af$Verwante kleure, soos blou en groen.$af$::text),
    ('c571bf3d', $af$Omdat dit werklik vir egte voëls moet werk, en dit ontwerpdenke met kunsvaardighede kombineer.$af$::text),
    ('71e5156f', $af$'n Mobiel hang en beweeg; 'n stabiel is soortgelyk, maar staan stil.$af$::text),
    ('38baa4d0', $af$Omdat 'n 3D-model van enige kant gesien kan word, moet dit van voor, agter en die kante af volledig lyk -- anders as 'n plat tekening.$af$::text),
    ('a3f68e60', $af$Deur gelaagde, oorvleuelende tekstuurmerke te gebruik wat verskil van die fyn lyne van pels of die gladde patroon van skubbe.$af$::text),
    ('84dd8db4', $af$Erken die gevoel van jaloesie, druk dit op 'n gepaste manier uit (byvoorbeeld deur met iemand daaroor te praat), en erken jou maat se prestasie regverdig.$af$::text),
    ('089da583', $af$Deur 'n persoonlike sterkpunt (soos deursettingsvermoë of oefening) te gebruik om aan die swakker area te werk, en so die teëslag in groei te verander.$af$::text),
    ('2cc4f259', $af$Omdat die deel van persoonlike higiëne-items soos tandeborsels kieme tussen mense kan versprei.$af$::text),
    ('22cdd383', $af$Dit is 'n morele les oor vrygewigheid; stories maak sulke lesse onthoubaar en interessant, eerder as net 'n droë opdrag.$af$::text),
    ('70f8f814', $af$Proporsie.$af$::text),
    ('01c7f8d8', $af$Proporsie (en ook kontras, aangesien klein/groot 'n duidelike verskil is).$af$::text),
    ('e04bc3fa', $af$Proporsie (grootteverskil) en kontras (vetdruk teenoor gewone druk).$af$::text),
    ('600b494d', $af$Byvoorbeeld kontras tussen 'n gespanne, reguit been en 'n ontspanne, geboë arm, of tussen lig en skaduwee oor die lyf.$af$::text),
    ('8e314f2a', $af$Deur die letter groter en/of vetter/kleurryker as die letters rondom dit te maak.$af$::text),
    ('05c7f52e', $af$Komplementêre kleur en beklemtoning (deur grootte, kleur of plasing).$af$::text),
    ('47038c76', $af$Klein, oorvleuelende, skubagtige merke vir die akkedis teenoor fyn, gepatroonde merke vir die skoenlappervlerk.$af$::text),
    ('3a00c33e', $af$Deur 'n hangende of uitstaande element by te voeg, soos 'n bondel krale wat afhang of 'n hangertjievorm.$af$::text),
    ('bec1237b', $af$Omdat klei fisies in drie dimensies gevorm en getekstureer kan word, wat werklike bultjies en riffels gee eerder as net getekende lyne.$af$::text),
    ('5ed3c08d', $af$Omdat die beklemtoning duidelik moet bly, maak nie saak van watter kant die kyker af kyk nie.$af$::text),
    ('17424903', $af$Luister met 'n oop gemoed, dink aan die voorstel as iets oor die werk (nie as 'n persoonlike aanval nie), en antwoord kalm.$af$::text),
    ('ee14dd06', $af$Byvoorbeeld: Diwali, wat verbind word met die aansteek van lampies en met vuurwerke.$af$::text),
    ('ab113159', $af$Byvoorbeeld rooi en groen -- as hulle langs mekaar geplaas word, lyk albei kleure helderder en kragtiger.$af$::text),
    ('1ea1f755', $af$Omdat 'n noukeurige blik dikwels verrassend helder kleure en patrone onthul wat 'n vlugtige kyk nie raaksien nie.$af$::text),
    ('341445d3', $af$Kontras en proporsie.$af$::text),
    ('de5a2c49', $af$Beklemtoning ('n fokuspunt).$af$::text),
    ('ad691925', $af$Balans, want 'n simmetriese gebou se visuele gewig is eweredig versprei.$af$::text),
    ('7175fa38', $af$Omdat enige fout of wanbalans in daardie eerste deel heeltemal rondom die ontwerp herhaal sal word.$af$::text),
    ('4b4b9453', $af$Direkte waarneming vang werklike, spesifieke besonderhede vas wat die verbeelding op sy eie waarskynlik sou misloop of veralgemeen.$af$::text),
    ('8aee7178', $af$Diep en vlak ruimte.$af$::text),
    ('9259ed7d', $af$'n Reliëf is meestal plat, met dele wat van 'n agterstuk af uitstaan, terwyl 'n volle beeldhouwerk heeltemal driedimensioneel en vrystaande is.$af$::text),
    ('fad66f73', $af$Omdat 'n 3D-kleimodel 'n werklike fisiese struktuur het wat van elke kant af akkuraat moet wees, anders as 'n enkele plat tekening.$af$::text),
    ('35447869', $af$Weier ferm maar vriendelik, en stel voor dat julle eers huiswerk doen of op 'n ander keer saamkuier.$af$::text),
    ('36562b0c', $af$Om hul verantwoordelikhede te prioritiseer en 'n aktiwiteitsplan op te stel.$af$::text),
    ('06ce9685', $af$Koel die brandwond behoorlik af (bv. met koel lopende water) en kry hulp by 'n grootmens of 'n dokter.$af$::text),
    ('dffff41a', $af$Byvoorbeeld Erfenisdag en Mandeladag; om hulle saam te vier, help om Suid-Afrikaners met verskillende agtergronde rondom gedeelde nasionale oomblikke te verenig.$af$::text),
    ('fb2a5157', $af$Omdat hierdie lewensfases sowel persoonlike as sosiale betekenis het, en gemeenskappe belangrike oorgange saam vier.$af$::text),
    ('43c62e70', $af$Beklemtoning -- die ingang word die fokuspunt van die gebou gemaak.$af$::text),
    ('3f3b31b1', $af$Omdat die subjek se blik hom of haar met die leë ruimte verbind, en so balans deur verhouding eerder as deur simmetrie skep.$af$::text),
    ('065fd400', $af$Simmetrie -- die identiese dele wat eweredig om die middelpunt herhaal.$af$::text),
    ('199fe180', $af$'n Monochromatiese kleurskema.$af$::text),
    ('e0ffddfc', $af$Die uitvoerende kunstenaar self (liggaam, stem, teenwoordigheid) is die produk, anders as by beroepe waar die persoon losstaan van wat hy of sy voortbring.$af$::text),
    ('71463bd1', $af$'n Dramaterapeut.$af$::text),
    ('4d6525e6', $af$Die beligtingsontwerper.$af$::text),
    ('7d6a218b', $af$Verhoogwerkers (gekoördineer deur die verhoogbestuurder).$af$::text),
    ('3cc54aae', $af$Dit weerspieël metamorfose -- om die voorwerp te verander terwyl sy oorspronklike vorm die nuwe ontwerp rig, eerder as om dit weg te steek.$af$::text),
    ('32e2a0f1', $af$Vasstik of vasbind (eerder as om hulle byvoorbeeld net los daarop te laat lê).$af$::text),
    ('1d7a2ce5', $af$Byvoorbeeld 'n plotselike, ligte, opwaartse beweging (energie: lig en plotseling; ruimte: wat na 'n hoë vlak opstyg).$af$::text),
    ('c905c096', $af$Sowel tyd (stadige tempo) as ruimte (lae vlak, geboë baan) word hier verken.$af$::text),
    ('e1c29f06', $af$Dit kan skok, plotselike spanning of 'n sleuteloomblik in die dans se storie oordra.$af$::text),
    ('a81ce3ae', $af$Afkoeling help spiere herstel en verminder spierpyn ná die dans, deur ontspanning en stadige strekoefeninge.$af$::text),
    ('95868d65', $af$Spotting -- om die oë op 'n punt vas te hou en die kop vinnig om te swaai tydens die draai -- verminder duiseligheid.$af$::text),
    ('9a6a683b', $af$Dit berei spiere en gewrigte fisies voor, wat die beseringsrisiko verlaag en beheer verbeter.$af$::text),
    ('28003550', $af$Gehoor/ruimte (gaste wat na die paartjie kyk), musiek (wat tydens die intrede gespeel word) en kostuums (formele klere).$af$::text),
    ('b0771228', $af$Die toneel sal waarskynlik verward en onsamehangend voel, omdat dit nie die struktuur het wat die wie/wat/waar/wanneer-vrae gee nie.$af$::text),
    ('c6649e5f', $af$Driedelige metrum (soos 'n wals).$af$::text),
    ('8539d977', $af$Sowel die dinamiek (sag na hard) as die tempo (stadig na vinnig) verander.$af$::text),
    ('ab4854fa', $af$Timbre (klankkleur).$af$::text),
    ('6403b052', $af$Dun tekstuur (net een laag).$af$::text),
    ('1e92a6fa', $af$Dit oefen behoorlike asemsteun, wat die grondslag is om werklik suiwer te sing.$af$::text),
    ('f615242f', $af$Dit is meerstemmige sang met 'n descant (bostem).$af$::text),
    ('dafa69d6', $af$Om lirieke te skryf (om 'n idee in woorde uit te druk) en om 'n melodie te komponeer (met die melodiese/ritmiese vaardighede wat deur die jaar opgebou is).$af$::text),
    ('bebdaf1f', $af$'n Ostinato (of riff).$af$::text),
    ('f04d7fab', $af$Kontras (wat beklemtoning skep en die oog na 'n fokuspunt trek).$af$::text),
    ('caf4dadc', $af$Die simmetrie skep balans, wat die gebou stabiel en ordelik laat voel.$af$::text),
    ('80443eb0', $af$Die telefoon, ontwikkel deur Alexander Graham Bell en Elisha Gray.$af$::text),
    ('94e5913c', $af$Dit is 'n mondelinge bron.$af$::text),
    ('bb90094c', $af$Toewyding.$af$::text),
    ('b2905eca', $af$Donkie, die uitvinding van die wiel, fiets, motor.$af$::text),
    ('db685472', $af$Om water uit riviere en strome te skep; boorgate en putte; en krane wat aan damme en suiweringsaanlegte gekoppel is.$af$::text),
    ('64319550', $af$Omdat die Nyl se jaarlikse vloede vrugbare grond na sy oewers gebring het, wat boerdery in die woestyn moontlik gemaak het.$af$::text),
    ('3cd091b5', $af$Kusvlakte, randgebergte en plato.$af$::text),
    ('e3a3dcda', $af$Kamele kon die woestyn se uiterste hitte en watertekort veel beter oorleef as ander diere.$af$::text),
    ('38748593', $af$Dat die liggaam geleer kan word om 'n siekte te beveg nog voordat dit die siekte ooit opdoen.$af$::text),
    ('7e78c3e0', $af$Sofala en Kilwa.$af$::text),
    ('918f45cc', $af$Kakaobone is die grondstof; sjokoladestafies is die vervaardigde produk.$af$::text),
    ('35d93fea', $af$Dit het ongeveer halfpad langs die seeroete tussen Europa en Asië gelê, wat dit 'n ideale verversingspos gemaak het.$af$::text),
    ('2145527b', $af$Omdat druk juis by die grense van tektoniese plate opbou, en aardbewings die plotselike vrylating van daardie druk is.$af$::text),
    ('6fb98242', $af$Vind waar roosterkolom C en roosterry 5 op die kaart sny; die skool is binne daardie blokkie.$af$::text),
    ('c0983067', $af$Water is 'n hernubare hulpbron, want dit kan homself met tyd aanvul as dit verantwoordelik gebruik word.$af$::text),
    ('4b9ee1ce', $af$Enige twee van: verhoogde voedselproduksie, inentings, beter sanitasie, antiseptika, ingemaakte kos en verkoeling.$af$::text),
    ('9d88c2cb', $af$Die koloniste het dit as weerstand teen onregverdige behandeling gesien; die Britse regering het dit as vandalisme en rebellie gesien.$af$::text),
    ('e29617ac', $af$Dit het hulle in staat gestel om lone te vermy en hul eie wins te maksimeer ten koste van slaafgemaakte mense se vryheid.$af$::text),
    ('232f021c', $af$Ingeboekte arbeiders was aan 'n arbeidskontrak met 'n vaste termyn gebind; Passasier-Indiërs het hul eie reis betaal en vrywillig gekom.$af$::text)
)
update public.lessons l
set afrikaans_worked_example =
      jsonb_set(l.afrikaans_worked_example, '{final_answer}', to_jsonb(t.final_answer))
from translated t
where l.id::text like t.prefix || '%';

-- 2. Afrikaans solution steps.
with translated(prefix, solution_steps) as (
  values
    ('ce60eca6', $af$["Bereken 125 ÷ 5: hoeveel 5's pas in 125 in? Die antwoord is 25.", "Bereken 5 ÷ 125: 125 is groter as 5, en pas dus nie eers een keer as 'n heelgetal in nie.", "Vergelyk: 25 is nie dieselfde as die piepklein uitkoms van 5 ÷ 125 nie, dus is die twee nie gelyk nie."]$af$::jsonb),
    ('512c5074', $af$["Kyk na die laaste syfer van 376, naamlik 6.", "Gaan na: is 6 een van 0, 2, 4, 6, 8 (ewe) of 1, 3, 5, 7, 9 (onewe)?", "6 staan in die ewe lys."]$af$::jsonb),
    ('24619f72', $af$["Verdeel 168 in 160 en 8.", "Halveer elke deel: die helfte van 160 is 80, die helfte van 8 is 4.", "Tel die uitkomste bymekaar: 80 + 4 = 84."]$af$::jsonb),
    ('8e43baf6', $af$["Skryf die getal in 'n plekwaardetabel: Duisendes | Honderdes | Tiene | Ene.", "Plaas elke syfer onder sy kolom: 4 | 3 | 7 | 1.", "Lees die waarde van elke syfer af: 4 is 4 000 werd, 3 is 300 werd, 7 is 70 werd, 1 is 1 werd."]$af$::jsonb),
    ('ed261c6d', $af$["Trek 'n tabel met die kolomme Duisendes, Honderdes, Tiene, Ene.", "Skryf 8, 4, 5, 6 van links na regs in die blokkies.", "Lees die kolomnaam bo elke syfer."]$af$::jsonb),
    ('8a9a9093', $af$["Gaan elke opsie na teen die vaardighede wat in hierdie eenheid gedek word.", "(a), (c) en (d) is alles Heelgetalle-vaardighede uit hierdie kwartaal.", "(b), om 'n horlosie te lees, hoort by 'n ander onderwerp (Tyd), nie by Heelgetalle nie."]$af$::jsonb),
    ('44ff7f60', $af$["Bereken 120 ÷ 10: hoeveel 10's pas in 120 in? Die antwoord is 12.", "Bereken 10 ÷ 120: 120 is veel groter as 10, dus is die uitkoms 'n klein breuk.", "Vergelyk: 12 is glad nie naby daardie piepklein breuk nie."]$af$::jsonb),
    ('18518631', $af$["Bepaal die verskil tussen elke paar: 8-6=2, 11-8=3, 15-11=4.", "Let op dat die verskille elke keer met 1 groei, dus is die volgende verskil 5.", "Tel daardie verskil by die laaste term: 15+5=20."]$af$::jsonb),
    ('4dffa9e8', $af$["Verdeel 168 in 160 en 8.", "Halveer elke deel: die helfte van 160 is 80, die helfte van 8 is 4.", "Tel die uitkomste bymekaar: 80 + 4 = 84."]$af$::jsonb),
    ('26cc08ed', $af$["A1 en C1 is in dieselfde ry, dus is geen op-of-af-beweging nodig nie.", "Beweeg oor die kolomme van A na C: 2 blokkies na regs."]$af$::jsonb),
    ('a07cf1f8', $af$["Dink aan die 8-maaltafel: die naaste feit onder 66 is 8 x 8 = 64.", "Trek af: 66 - 64 = 2.", "Dus is 66 ÷ 8 = 8, met 2 oor."]$af$::jsonb),
    ('84fb1b40', $af$["Stel 'n plekwaardetabel met 6 kolomme op: Honderdduisendes tot Ene.", "Plaas die syfers van 871 253 in die tabel.", "Lees die kolom bo die 7: Tienduisendes."]$af$::jsonb),
    ('8ab128f5', $af$["'n Translasie is 'n skuif sonder enige draai.", "'n Refleksie is 'n omflip wat 'n spieëlbeeld gee.", "'n Rotasie is 'n draai om 'n vaste punt, wat ooreenstem met '90 grade om sy middelpunt gedraai'."]$af$::jsonb),
    ('aee628a0', $af$["Wanneer jy van bo af kyk, sien jy die 'bo-aansig' van die voorwerp.", "By 'n reghoekige boks is die bo-aansig 'n plat reghoek of vierkant."]$af$::jsonb),
    ('517ba1bb', $af$["Vergelyk die Graad 4-vaardighede (deling deur 1-syfergetalle) met die Graad 5-vaardighede (deling deur 2-syfergetalle).", "Let op dat die getalle groter geword het, maar dat die strategieë dieselfde bly."]$af$::jsonb),
    ('89162381', $af$["Deelbaar deur 2? Die laaste syfer is 0, wat ewe is -- ja.", "Deelbaar deur 5? Die laaste syfer moet 0 of 5 wees -- ja, dit is 0.", "Deelbaar deur 10? Die laaste syfer is 0 -- ja."]$af$::jsonb),
    ('13f59e93', $af$["Onthou of bereken dat 18 x 18 = 324.", "Dit beteken 324 ÷ 18 = 18.", "18 ÷ 324 is veel kleiner as 1, aangesien 324 veel groter as 18 is."]$af$::jsonb),
    ('32c8a466', $af$["Stel 'n plekwaardetabel vir 'n getal met 7 syfers op.", "Plaas die syfers van 7 693 417 daarin.", "Soek die 6: sy plekwaarde is Honderdduisendes, en sy waarde is 600 000."]$af$::jsonb),
    ('d26ea738', $af$["Die vooraansig van 'n huisvormige blok wys gewoonlik die driehoek van die dak.", "'n Aansig daarsonder is heel waarskynlik die sy-aansig."]$af$::jsonb),
    ('e04c42db', $af$["Vergelyk die Graad 6-vaardigheidslys met dié van vroeër grade.", "Deelbaarheidsreëls is nuut in hierdie afdeling."]$af$::jsonb),
    ('8b108427', $af$["Vergelyk elke term met sy posisie: 1ste=3, 2de=6, 3de=9.", "Let op dat elke term 3 maal sy posisie is.", "Skryf die reël as 'n formule: 3n."]$af$::jsonb),
    ('5d667be5', $af$["Bereken a + b: 12 + 7 = 19.", "Bereken b + a: 7 + 12 = 19.", "Albei gee dieselfde antwoord."]$af$::jsonb),
    ('68aafbd6', $af$["Om 0 by enige getal te tel, verander nie sy waarde nie.", "Dus is 243 + 0 = 243.", "Dit is die identiteitseienskap van optelling."]$af$::jsonb),
    ('b9cc40ac', $af$["Breek 192 op in twee gerieflike dele: 160 en 32 (want 160 + 32 = 192).", "Deel elke deel deur 8: 160 ÷ 8 = 20, en 32 ÷ 8 = 4.", "Tel die twee antwoorde bymekaar: 20 + 4 = 24."]$af$::jsonb),
    ('c675de92', $af$["Begin by 8 op die getallelyn.", "Spring herhaaldelik 2 terug: 8, 6, 4, 2, 0.", "Tel die spronge: 4 spronge was nodig om by 0 uit te kom."]$af$::jsonb),
    ('fa099a36', $af$["Verander die deling in 'n vermenigvuldigingsvraag: 9 × ? = 72.", "Dink aan die 9-maaltafel: 9 × 8 = 72.", "Die ontbrekende getal, en dus die antwoord op 72 ÷ 9, is 8."]$af$::jsonb),
    ('c5973472', $af$["7/100 beteken 7 honderdstes, wat twee syfers ná die komma vereis.", "Skryf 'n 0 in die tiendes-plek en 'n 7 in die honderdstes-plek.", "Die uitkoms is 0,07."]$af$::jsonb),
    ('be45c758', $af$["Verdeel 20 in sy faktore: 10 x 2.", "Deel eers deur 10: 680 ÷ 10 = 68.", "Deel dan deur 2: 68 ÷ 2 = 34."]$af$::jsonb),
    ('479d38d3', $af$["Rond 187 op na die naaste tien: 190 (dit gebruik 3 van die 7).", "Jy het nog 4 van die 7 oor.", "Tel die oorblywende 4 by 190: 190 + 4 = 194."]$af$::jsonb),
    ('7705143c', $af$["Let op dat 132 = 12 x 11.", "Deel eers deur 12: 34 848 ÷ 12 = 2 904.", "Deel dan deur 11: 2 904 ÷ 11 = 264."]$af$::jsonb),
    ('2d024153', $af$["Tel in 5's: 5, 10, 15, 20.", "Dit is die eerste vier veelvoude van 5.", "Skryf hulle in versamelingnotasie: M5 = {5; 10; 15; 20; ...}."]$af$::jsonb),
    ('232a033e', $af$["Tel in 8's: 8, 16, 24, 32.", "Skryf hulle in versamelingnotasie."]$af$::jsonb),
    ('b2d6f7c5', $af$["Bereken 55 x 17 = 935.", "Bereken 17 x 55 = 935.", "Albei gee dieselfde antwoord, wat die kommutatiewe eienskap bevestig."]$af$::jsonb),
    ('de110c32', $af$["'n Plat patroon wat nie varieer nie, het geen kontras nie.", "Deur die vorms en groottes doelbewus te varieer, skep jy kontras en visuele belangstelling."]$af$::jsonb),
    ('c488bb82', $af$["Dink aan die pare wat sekondêre kleure maak.", "Blou en geel is een van die drie kombinasies wat 'n sekondêre kleur gee."]$af$::jsonb),
    ('1ed0f5ec', $af$["'n Tint (gemeng met wit) maak 'n kleur ligter, vir sonlig.", "'n Skakering (gemeng met swart) maak 'n kleur donkerder, vir skaduwee."]$af$::jsonb),
    ('5b8b0a02', $af$["Harmonieuse kleure lê naby mekaar op die kleurwiel.", "Vir 'n seetoneel sal blou en groen verwante kleure wees."]$af$::jsonb),
    ('c571bf3d', $af$["'n Voëlvoerbakkie is bedoel om deur egte voëls gebruik te word.", "Dit moet veilig en funksioneel wees, nie net mooi om na te kyk nie."]$af$::jsonb),
    ('71e5156f', $af$["'n Mobiel hang en beweeg.", "'n Stabiel is 'n soortgelyke konstruksie, maar dit staan stil."]$af$::jsonb),
    ('38baa4d0', $af$["'n Tekening het net een plat aansig.", "'n 3D-model bestaan in werklike ruimte en kan van enige kant bekyk word.", "Daarom moet 'n 3D-model van elke kant af deurdag lyk, nie net van een kant nie."]$af$::jsonb),
    ('a3f68e60', $af$["Dink aan die verskillende oppervlakeienskappe van pels, skubbe en vere.", "Vere kan met gelaagde, oorvleuelende merke gewys word, anders as die fyn lyne van pels of die gladde patrone van skubbe."]$af$::jsonb),
    ('84dd8db4', $af$["Erken die emosie (jaloesie) eerder as om dit te ignoreer.", "Vind 'n gepaste manier om die gevoel uit te druk of te verwerk, eerder as om jou sleg te gedra.", "Dink ook aan die ander persoon se gevoelens -- hy of sy het die lof verdien."]$af$::jsonb),
    ('089da583', $af$["Besef dat nie elke poging slaag nie, en dat dit normaal is.", "Dink aan 'n persoonlike sterkpunt wat kan help om die swakker area te verbeter (byvoorbeeld om meer sangoefening te doen).", "Gebruik daardie sterkpunt om die teëslag in 'n kans om te groei te verander."]$af$::jsonb),
    ('2cc4f259', $af$["Persoonlike higiëne-items kan kieme dra.", "As jy hulle deel, kan daardie kieme tussen mense versprei."]$af$::jsonb),
    ('22cdd383', $af$["Dit is 'n morele les -- oor vriendelikheid en vrygewigheid.", "Stories maak lesse dikwels onthoubaar en betekenisvol op maniere wat 'n blote reël nie kan nie."]$af$::jsonb),
    ('70f8f814', $af$["Dit gaan oor 'n grootteverhouding tussen die voël en die tak.", "Grootteverhoudings is proporsie."]$af$::jsonb),
    ('01c7f8d8', $af$["Dit gaan oor 'n grootteverhouding tussen twee diere.", "Grootteverhoudings tussen dele of voorwerpe is proporsie."]$af$::jsonb),
    ('e04bc3fa', $af$["'n Groot woord in vetdruk teenoor kleiner teks wys 'n grootteverskil: proporsie.", "Die visuele verskil tussen vetdruk en gewone druk wys ook kontras."]$af$::jsonb),
    ('600b494d', $af$["Dink aan pare teenoorgesteldes: lig/donker, gespanne/ontspanne, reguit/geboë.", "Soek 'n gespanne, uitgestrekte been teenoor 'n ontspanne arm, of lig teenoor skaduwee op die lyf."]$af$::jsonb),
    ('8e314f2a', $af$["Dink aan die middele tot jou beskikking: grootte, kleur, vetdruk.", "Deur die letter groter en/of kleurryker as die res te maak, kry jy beklemtoning."]$af$::jsonb),
    ('05c7f52e', $af$["Dink aan komplementêre kleur en beklemtoning, wat albei hierdie kwartaal bekendgestel is.", "Gebruik 'n komplementêre kleurskema en doelbewuste beklemtoning (grootte/plasing) op die hooffiguur."]$af$::jsonb),
    ('47038c76', $af$["'n Akkedis se vel is skubagtig, en klein, oorvleuelende merke kan dit wys.", "'n Skoenlapper se vlerk is gepatroon en delikaat, en fyner, meer versierde merke kan dit wys."]$af$::jsonb),
    ('3a00c33e', $af$["Dink aan 'n hangende element, soos 'n bondel krale wat onder die hoofstuk afhang.", "Dit strek in driedimensionele ruimte in, eerder as om plat teen die lyf te bly."]$af$::jsonb),
    ('bec1237b', $af$["Klei is 'n fisiese, driedimensionele materiaal.", "Dit kan getekstureer word om werklike bultjies en riffels te vorm, anders as 'n plat getekende oppervlak."]$af$::jsonb),
    ('5ed3c08d', $af$["'n Tekening word van een vaste hoek af bekyk.", "'n 3D-toneel kan van enige kant af bekyk word, dus moet die beklemtoning van elke kant af werk."]$af$::jsonb),
    ('17424903', $af$["Bly oop eerder as verdedigend.", "Beskou die terugvoer as iets oor die werk, nie as 'n persoonlike aanval nie.", "Bedank die persoon en oorweeg dit om die voorstel te gebruik."]$af$::jsonb),
    ('ee14dd06', $af$["Dink aan die feeste wat in hierdie les genoem word.", "Kies een en die gebruik wat daarmee saamgaan, bv. Diwali en die aansteek van lampies."]$af$::jsonb),
    ('ab113159', $af$["Dink aan die komplementêre pare: rooi/groen, blou/oranje, geel/pers.", "As hulle langs mekaar geplaas word, laat elke kleur die ander een helderder lyk."]$af$::jsonb),
    ('1ea1f755', $af$["Baie mense kyk in die daaglikse lewe by klein diertjies verby.", "'n Noukeurige blik onthul dikwels helder kleure wat 'n mens met 'n vlugtige kyk nie sien nie."]$af$::jsonb),
    ('341445d3', $af$["Klein teenoor onmeetlik groot is 'n grootteverskil: kontras.", "Die grootteverhouding tussen die voël en die lug is ook proporsie."]$af$::jsonb),
    ('de5a2c49', $af$["Albei soorte ontwerp kan 'n fokuspunt gebruik.", "Dit word beklemtoning genoem."]$af$::jsonb),
    ('ad691925', $af$["'n Simmetriese gebou het visuele gewig wat eweredig versprei is.", "Balans is die ontwerpbeginsel wat hierdie eweredige verspreiding beskryf."]$af$::jsonb),
    ('7175fa38', $af$["Daardie deel word verskeie kere rondom die ontwerp herhaal.", "Enige wanbalans daarin sal deur die hele patroon herhaal."]$af$::jsonb),
    ('4b4b9453', $af$["Direkte waarneming onthul werklike, spesifieke besonderhede.", "As jy uit die verbeelding teken, kry jy dikwels 'n algemene, minder akkurate vorm."]$af$::jsonb),
    ('8aee7178', $af$["'n Reliëf lê meestal plat, met dele wat uitstaan.", "Dit vra vir diep en vlak ruimte, nie vir volle bewustheid van voor, agter en die kante nie."]$af$::jsonb),
    ('9259ed7d', $af$["'n Reliëf lê meestal teen 'n plat agterstuk.", "'n Volledig driedimensionele beeldhouwerk staan op sy eie en kan van elke kant af bekyk word."]$af$::jsonb),
    ('fad66f73', $af$["Klei het werklike, fisiese gewig en 'n driedimensionele struktuur.", "Om die proporsies werklik akkuraat te kry, is belangriker as in 'n plat tekening, want 'n kleimodel kan van elke werklike kant af nagegaan word."]$af$::jsonb),
    ('35447869', $af$["Erken die situasie as groepsdruk.", "Dink aan 'n gepaste reaksie, bv. om 'n ander tyd voor te stel om saam te kuier, of om ferm nee te sê.", "Tree volgens jou eie waardes op eerder as volgens die druk."]$af$::jsonb),
    ('36562b0c', $af$["Erken dat verskeie verantwoordelikhede om dieselfde tyd meeding.", "Prioritisering help jou besluit wat die belangrikste is en eerste gedoen moet word.", "'n Aktiwiteitsplan deel die tyd vir al drie uit."]$af$::jsonb),
    ('06ce9685', $af$["Dink aan die noodhulpriglyne vir brandwonde.", "Om die brandwond behoorlik af te koel, is 'n algemene basiese eerste reaksie.", "Kry behoorlike mediese hulp as dit nodig is."]$af$::jsonb),
    ('dffff41a', $af$["Dink aan die nasionale dae wat in hierdie les genoem word.", "Verduidelik dat gedeelde viering mense met verskillende kulturele agtergronde in een nasie verenig."]$af$::jsonb),
    ('fb2a5157', $af$["Oorgangsrites merk belangrike oorgange in 'n mens se lewe.", "Hierdie oorgange het sosiale betekenis, nie net persoonlike betekenis nie.", "Gemeenskappe kom bymekaar om daardie betekenis saam te deel en te ondersteun."]$af$::jsonb),
    ('43c62e70', $af$["'n Groot, versierde ingang trek die oog eerste.", "Dit is presies wat beklemtoning ('n fokuspunt) beteken."]$af$::jsonb),
    ('3f3b31b1', $af$["Die subjek se blik rig die aandag na die leë ruimte.", "Dit skep 'n visuele verhouding tussen die subjek en die ruimte, wat die komposisie balanseer selfs sonder simmetrie."]$af$::jsonb),
    ('065fd400', $af$["Identiese dele wat eweredig herhaal, skep simmetrie.", "Simmetrie is een algemene manier om balans te bereik."]$af$::jsonb),
    ('199fe180', $af$["Net een kleurtoon (groen) word deurgaans gebruik.", "Om tinte en skakerings van 'n enkele kleur te gebruik, is monochromaties."]$af$::jsonb),
    ('e0ffddfc', $af$["Dink na oor wat die 'produk' van die beroep eintlik is.", "In uitvoerende beroepe is die kunstenaar se eie liggaam, stem of teenwoordigheid die werklike produk wat gelewer word."]$af$::jsonb),
    ('71463bd1', $af$["Om dramategnieke vir emosionele verwerking te gebruik, en nie vir 'n opvoering nie, is terapeuties.", "Dit stem ooreen met die beskrywing van 'n dramaterapeut."]$af$::jsonb),
    ('4d6525e6', $af$["Hierdie verandering het te doen met die gebruik van lig om stemming en storievertelling te vorm.", "Die beligtingsontwerper is verantwoordelik vir die beligtingskeuses."]$af$::jsonb),
    ('7d6a218b', $af$["Om dekor en toerusting tydens toneelwisselings te skuif, is 'n verhoogwerker se taak.", "Dit gebeur onder die koördinasie van die verhoogbestuurder."]$af$::jsonb),
    ('3cc54aae', $af$["Die voorwerp se oorspronklike vorm word in die nuwe ontwerp opgeneem, nie weggesteek nie.", "Dit weerspieël die idee van metamorfose -- om die voorwerp te verander terwyl sy oorspronklike vorm steeds die uitkoms rig."]$af$::jsonb),
    ('32e2a0f1', $af$["Krale moet veilig aan 'n oppervlak vasgemaak word.", "Vasstik en vasbind is vakmanskaptegnieke wat geskik is om klein voorwerpe soos krale veilig vas te maak."]$af$::jsonb),
    ('1d7a2ce5', $af$["Dink aan die werklike aard van 'n voël wat opvlieg: lig, opwaarts, plotseling.", "Dit kan deur die ruimte-element (wat na 'n hoë vlak opstyg) of die energie-element ('n ligte, plotselike uitbarsting) uitgedruk word."]$af$::jsonb),
    ('c905c096', $af$["'Stadig' beskryf tempo, wat deel van die tyd-element is.", "'Laag' beskryf vlak, en 'geboë baan' beskryf die baan -- albei deel van die ruimte-element."]$af$::jsonb),
    ('e1c29f06', $af$["'n Plotselike stilstand breek die vloei van die beweging skielik.", "Dit kan skok, spanning of 'n dramatiese wending in die storie oordra."]$af$::jsonb),
    ('a81ce3ae', $af$["Dink aan wat afkoeling eintlik fisies doen.", "Dit help spiere herstel deur ontspanning en stadige strekoefeninge, en verminder so spierpyn."]$af$::jsonb),
    ('95868d65', $af$["Duiseligheid tydens draaie word dikwels veroorsaak deurdat die oë aanhoudend beweeg in plaas van op een punt vas te hou.", "Spotting hou die oë op een punt vas en swaai die kop vinniger om as die liggaam.", "Om spotting te oefen, verminder die disoriëntasie wat duiseligheid veroorsaak."]$af$::jsonb),
    ('9a6a683b', $af$["'n Opwarming berei spiere en gewrigte fisies voor.", "Dit verlaag die beseringsrisiko en verbeter beheer tydens beweging."]$af$::jsonb),
    ('28003550', $af$["Gaste wat na die paartjie kyk en toekyk, is die gehoor/ruimte-element.", "Musiek wat speel, is die musiek/begeleiding-element.", "Formele klere is die kostuum-element."]$af$::jsonb),
    ('b0771228', $af$["Sonder antwoorde op wie/wat/waar/wanneer het die toneel geen struktuur nie.", "Dit lei waarskynlik tot verwarde, onsamehangende improvisasie sonder 'n duidelike begin, middel en einde."]$af$::jsonb),
    ('c6649e5f', $af$["Tel hoeveel maatslae in elke groep herhaal.", "Die patroon groepeer in stelle van drie maatslae.", "Drie maatslae per groep is driedelige metrum."]$af$::jsonb),
    ('8539d977', $af$["'Sag' na 'hard' beskryf 'n verandering in dinamiek.", "'Stadig' na 'vinnig' beskryf 'n verandering in tempo."]$af$::jsonb),
    ('ab4854fa', $af$["Die toonhoogte en volume is identies, dus verklaar dit nie die verskil nie.", "Die oorblywende eienskap wat instrumente se klank onderskei, is timbre (klankkleur)."]$af$::jsonb),
    ('6403b052', $af$["Tekstuur beskryf hoeveel lae gelyktydig gebeur.", "Een instrument wat een melodie speel, is 'n enkele laag.", "'n Enkele laag is dun tekstuur."]$af$::jsonb),
    ('1e92a6fa', $af$["Sang vereis beheerde asemsteun.", "Asemoefeninge bou hierdie steun op, wat die grondslag is om suiwer te bly sing."]$af$::jsonb),
    ('f615242f', $af$["'n Tweede, hoër aanvullende melodie wat bo die hoofwysie gesing word, is 'n descant.", "Om met 'n descant te sing, is 'n vorm van meerstemmige sang."]$af$::jsonb),
    ('dafa69d6', $af$["Om lirieke te skryf, verg die vermoë om 'n idee in woorde uit te druk.", "Om 'n melodie te skryf, verg melodiese/ritmiese komponeervaardighede wat deur die jaar opgebou is.", "Die twee vaardighede saam maak 'n volledige oorspronklike lied."]$af$::jsonb),
    ('bebdaf1f', $af$["'n Kort musikale of ritmiese patroon wat aanhoudend herhaal, is 'n ostinato (of riff).", "Dit gee 'n vaste grondslag waarop daarbo geïmproviseer kan word."]$af$::jsonb),
    ('f04d7fab', $af$["Die rooi appel staan skerp uit teen die groen appels.", "'n Sterk visuele verskil wat die oog trek, is kontras.", "Hierdie kontras skep ook beklemtoning -- 'n fokuspunt."]$af$::jsonb),
    ('caf4dadc', $af$["'n Simmetriese fasade beteken dat die twee kante mekaar eweredig weerspieël.", "Dit skep balans, wat die gebou stabiel en ordelik laat voel."]$af$::jsonb),
    ('80443eb0', $af$["Dink aan elke uitvinder: Marconi (radio), Bell (telefoon), Eastman (kamera).", "Dit is juis die telefoon wat 'n gesproke gesprek oor 'n afstand in reële tyd moontlik maak."]$af$::jsonb),
    ('94e5913c', $af$["Dink aan die vier soorte: visuele, geskrewe en mondelinge bronne, en voorwerpe.", "'n Gesproke storie wat deur 'n persoon oorgedra word, is 'n mondelinge bron."]$af$::jsonb),
    ('bb90094c', $af$["Dink aan die vier eienskappe: moed, toewyding, passie en selfopoffering.", "'Om aan te hou sonder om op te gee' pas by die definisie van toewyding -- algehele verbondenheid.", "Toewyding is die beste passing."]$af$::jsonb),
    ('b2905eca', $af$["Diere soos die donkie het eerste gekom.", "Die uitvinding van die wiel het daarna gekom.", "Die fiets het gevolg.", "Die motor het laaste gekom."]$af$::jsonb),
    ('db685472', $af$["Dink aan die drie metodes wat beskryf is: riviere/strome, boorgate/putte, krane.", "Noem al drie."]$af$::jsonb),
    ('64319550', $af$["Dink aan die uitwerking van die Nyl se jaarlikse vloede.", "Die vloede het vrugbare grond gebring, wat boerdery in 'n andersins droë woestyn moontlik gemaak het."]$af$::jsonb),
    ('3cd091b5', $af$["Dink aan die drie begrippe wat beskryf is.", "Noem hulle in orde van die kus na die binneland."]$af$::jsonb),
    ('e3a3dcda', $af$["Dink aan die toestande in die Sahara-woestyn: uiterste hitte, min water.", "Kamele kan hierdie harde toestande veel beter oorleef as ander diere."]$af$::jsonb),
    ('38748593', $af$["Dink aan wat 'n entstof doen.", "Dit leer die liggaam om 'n siekte te beveg voordat dit die siekte opdoen."]$af$::jsonb),
    ('7e78c3e0', $af$["Dink aan die stede wat beskryf is.", "Sofala en Kilwa word albei genoem."]$af$::jsonb),
    ('918f45cc', $af$["Grondstowwe word direk uit die natuur geneem.", "Vervaardigde produkte word gemaak deur grondstowwe te verwerk.", "Kakaobone = grondstof; sjokoladestafies = vervaardigde produk."]$af$::jsonb),
    ('35d93fea', $af$["Dink aan die seeroete tussen Europa en Asië.", "Die Kaap lê ongeveer halfpad langs daardie roete, wat dit 'n ideale plek gemaak het om voorrade aan te vul."]$af$::jsonb),
    ('2145527b', $af$["Onthou dat druk opbou waar plate teen mekaar skuur, wegtrek of teen mekaar stoot.", "Aardbewings vind plaas wanneer hierdie opgeboude druk vrygelaat word.", "Hierdie druk bou net by plaatgrense op, en daarom kom aardbewings juis daar saam voor."]$af$::jsonb),
    ('6fb98242', $af$["Soek kolom C langs die rand van die kaart.", "Soek ry 5 langs die ander rand.", "Kyk waar kolom C en ry 5 ontmoet -- die skool is ergens in daardie blokkie."]$af$::jsonb),
    ('c0983067', $af$["Dink na of water homself met tyd kan aanvul.", "Water sirkuleer deur reën, riviere en verdamping, en kan dus hernu as dit verantwoordelik bestuur word."]$af$::jsonb),
    ('4b9ee1ce', $af$["Dink aan die faktore wat beskryf is: voedselproduksie en wetenskaplike ontdekkings.", "Noem twee: bv. verhoogde voedselproduksie en inentings."]$af$::jsonb),
    ('9d88c2cb', $af$["Dink aan die koloniste se standpunt: weerstand teen onregverdige belasting.", "Dink aan die Britse regering se standpunt: die vernietiging van eiendom en rebellie.", "Albei sienings kom uit dieselfde gebeurtenis, maar van verskillende kante gesien."]$af$::jsonb),
    ('e29617ac', $af$["Dink aan die koste van betaalde arbeid teenoor onbetaalde, gedwonge arbeid.", "Deur slaafgemaakte arbeid te gebruik, kon eienaars lone vermy en hul eie wins maksimeer."]$af$::jsonb),
    ('232f021c', $af$["'n Ingeboekte arbeider werk onder 'n kontrak met 'n vaste termyn, dikwels in harde toestande.", "'n Passasier-Indiër het sy of haar eie reis betaal en vrywillig gekom, dikwels om handel te dryf.", "Die belangrikste verskil is die voorwaardes waaronder elke groep gereis en gewerk het."]$af$::jsonb)
)
update public.lessons l
set afrikaans_worked_example =
      jsonb_set(l.afrikaans_worked_example, '{solution_steps}', t.solution_steps)
from translated t
where l.id::text like t.prefix || '%';

-- 3. Two factual errors in the English, found by reading it closely enough to
--    translate it. The Afrikaans above already carries the corrected wording.
--      32c8a466 'Names for very large numbers' said to set up a place value
--               table for a 9-digit number; the number in the question,
--               7 693 417, has 7 digits.
--      c488bb82 'Create in 2D: images of family and friends' said blue and
--               yellow 'are two of the three secondary colour combinations'.
--               Blue and yellow is one combination, not two.
with corrected(prefix, solution_steps) as (
  values
    ('32c8a466', $af$["Set up a place value table for a 7-digit number.", "Place the digits of 7 693 417 into it.", "Find the 6: its place value is Hundred Thousands, and its value is 600 000."]$af$::jsonb),
    ('c488bb82', $af$["Recall the secondary colour pairs.", "Blue and yellow are one of the three secondary colour combinations."]$af$::jsonb)
)
update public.lessons l
set worked_example = jsonb_set(l.worked_example, '{solution_steps}', c.solution_steps)
from corrected c
where l.id::text like c.prefix || '%';

