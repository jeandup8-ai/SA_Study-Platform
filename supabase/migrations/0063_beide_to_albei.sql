-- Replace every "beide" at the user's request.
--
-- Not a word swap. "beide" covers two different jobs here, and only one of
-- them takes "albei":
--
--   * 13 places use it as a determiner or pronoun over two things already
--     identified -- "beide getalle", "Beide deel dieselfde elemente". Those
--     become "albei".
--
--   * 34 places use the correlative "beide X en Y" (both X and Y).
--     "albei X en Y" is not Afrikaans -- the correlative is "sowel X as Y",
--     which also means replacing the "en". A blind find-and-replace here
--     would have produced 34 ungrammatical sentences.

update public.lessons set afrikaans_worked_example =
  replace(afrikaans_worked_example::text, $x$Kombineer beide effekte$x$, $x$Kombineer albei effekte$x$)::jsonb
 where afrikaans_worked_example::text like $x$%Kombineer beide effekte%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Beide deel dieselfde onderliggende elemente$x$, $x$Albei deel dieselfde onderliggende elemente$x$)
 where afrikaans_narration_script like $x$%Beide deel dieselfde onderliggende elemente%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide is sorgvuldig gestruktureerde ervarings$x$, $x$albei is sorgvuldig gestruktureerde ervarings$x$)
 where afrikaans_narration_script like $x$%beide is sorgvuldig gestruktureerde ervarings%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Beide vaardighede steun op$x$, $x$Albei vaardighede steun op$x$)
 where afrikaans_narration_script like $x$%Beide vaardighede steun op%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide onderwerpe deel dieselfde$x$, $x$albei onderwerpe deel dieselfde$x$)
 where afrikaans_narration_script like $x$%beide onderwerpe deel dieselfde%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$om beide getalle eers af te rond$x$, $x$om albei getalle eers af te rond$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%om beide getalle eers af te rond%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$as beide getalle dieselfde teken het$x$, $x$as albei getalle dieselfde teken het$x$)
 where afrikaans_narration_script like $x$%as beide getalle dieselfde teken het%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$Wanneer beide getalle dieselfde teken het$x$, $x$Wanneer albei getalle dieselfde teken het$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%Wanneer beide getalle dieselfde teken het%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$alleseters eet beide.$x$, $x$alleseters eet albei.$x$)
 where afrikaans_narration_script like $x$%alleseters eet beide.%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$om beide getalle volgens plekwaarde$x$, $x$om albei getalle volgens plekwaarde$x$)
 where afrikaans_narration_script like $x$%om beide getalle volgens plekwaarde%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$gebruik beide vanjaar se nuwe idees$x$, $x$gebruik albei vanjaar se nuwe idees$x$)
 where afrikaans_narration_script like $x$%gebruik beide vanjaar se nuwe idees%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Om beide hierdie onderwerpe saam te verken$x$, $x$Om albei hierdie onderwerpe saam te verken$x$)
 where afrikaans_narration_script like $x$%Om beide hierdie onderwerpe saam te verken%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$Dink aan wat beide soorte versiering saamstel.$x$, $x$Dink aan wat albei soorte versiering saamstel.$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%Dink aan wat beide soorte versiering saamstel.%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$om beide jou sterk punte en groeigebiede op 'n regverdige$x$, $x$om sowel jou sterk punte as groeigebiede op 'n regverdige$x$)
 where afrikaans_narration_script like $x$%om beide jou sterk punte en groeigebiede op 'n regverdige%$x$;

update public.lessons set afrikaans_visual_storyboard =
  replace(afrikaans_visual_storyboard::text, $x$wat beide komplementêre kleurkontras en klem skep$x$, $x$wat sowel komplementêre kleurkontras as klem skep$x$)::jsonb
 where afrikaans_visual_storyboard::text like $x$%wat beide komplementêre kleurkontras en klem skep%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$deur ander -- beide volwassenes en portuurgroep -- en deur jou eie$x$, $x$deur ander -- sowel volwassenes as die portuurgroep -- en deur jou eie$x$)
 where afrikaans_narration_script like $x$%deur ander -- beide volwassenes en portuurgroep -- en deur jou eie%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide van en aan jou portuurgroep en volwassenes$x$, $x$sowel van as aan jou portuurgroep en volwassenes$x$)
 where afrikaans_narration_script like $x$%beide van en aan jou portuurgroep en volwassenes%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$gedeel deur beide teater en werklike kulturele gebeure$x$, $x$gedeel deur sowel teater as werklike kulturele gebeure$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%gedeel deur beide teater en werklike kulturele gebeure%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$beide herhaling en variasie in 'n musiekstuk gebruik$x$, $x$sowel herhaling as variasie in 'n musiekstuk gebruik$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%beide herhaling en variasie in 'n musiekstuk gebruik%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$maak beide jou lees en jou skryf baie sterker$x$, $x$maak sowel jou lees as jou skryf baie sterker$x$)
 where afrikaans_narration_script like $x$%maak beide jou lees en jou skryf baie sterker%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide natuurlik, soos voëls en insekte, en meganies, soos vliegtuie en vlieërs$x$, $x$sowel natuurlik, soos voëls en insekte, as meganies, soos vliegtuie en vlieërs$x$)
 where afrikaans_narration_script like $x$%beide natuurlik, soos voëls en insekte, en meganies, soos vliegtuie en vlieërs%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Om beide selfbestuur en die wortels van afknouery te verstaan$x$, $x$Om sowel selfbestuur as die wortels van afknouery te verstaan$x$)
 where afrikaans_narration_script like $x$%Om beide selfbestuur en die wortels van afknouery te verstaan%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$gebruik beide inheemse en moderne medisyne saam$x$, $x$gebruik sowel inheemse as moderne medisyne saam$x$)
 where afrikaans_narration_script like $x$%gebruik beide inheemse en moderne medisyne saam%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$toepaslike gebruik vir beide veiligheid en kwaliteit saak maak$x$, $x$toepaslike gebruik vir sowel veiligheid as kwaliteit saak maak$x$)
 where afrikaans_narration_script like $x$%toepaslike gebruik vir beide veiligheid en kwaliteit saak maak%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$beskikbaar bly vir beide huidige en toekomstige generasies$x$, $x$beskikbaar bly vir sowel huidige as toekomstige generasies$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%beskikbaar bly vir beide huidige en toekomstige generasies%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$hierdie fisiese vaardighede beide doeltreffend en veilig te beoefen$x$, $x$hierdie fisiese vaardighede sowel doeltreffend as veilig te beoefen$x$)
 where afrikaans_narration_script like $x$%hierdie fisiese vaardighede beide doeltreffend en veilig te beoefen%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$help om beide die liggaam en die gemoed te kalmeer$x$, $x$help om sowel die liggaam as die gemoed te kalmeer$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%help om beide die liggaam en die gemoed te kalmeer%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide wanneer dit met jou gebeur en wanneer dit met ander gebeur$x$, $x$sowel wanneer dit met jou gebeur as wanneer dit met ander gebeur$x$)
 where afrikaans_narration_script like $x$%beide wanneer dit met jou gebeur en wanneer dit met ander gebeur%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$dra by tot beide jou eie welstand en die welstand van jou wyer gemeenskap$x$, $x$dra by tot sowel jou eie welstand as die welstand van jou wyer gemeenskap$x$)
 where afrikaans_narration_script like $x$%dra by tot beide jou eie welstand en die welstand van jou wyer gemeenskap%$x$;

update public.lessons set afrikaans_worked_example =
  replace(afrikaans_worked_example::text, $x$om beide sy/haar eie herstel en die gesondheid van sy/haar klasmaats te beskerm$x$, $x$om sowel sy/haar eie herstel as die gesondheid van sy/haar klasmaats te beskerm$x$)::jsonb
 where afrikaans_worked_example::text like $x$%om beide sy/haar eie herstel en die gesondheid van sy/haar klasmaats te beskerm%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Beide volksverhaal-opvoering en koorvers vereis$x$, $x$Sowel volksverhaal-opvoering as koorvers vereis$x$)
 where afrikaans_narration_script like $x$%Beide volksverhaal-opvoering en koorvers vereis%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Beide die faktormetode en die halveringsmetode bereik$x$, $x$Sowel die faktormetode as die halveringsmetode bereik$x$)
 where afrikaans_narration_script like $x$%Beide die faktormetode en die halveringsmetode bereik%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$met beide merkwaardige prestasies en pynlike hoofstukke$x$, $x$met sowel merkwaardige prestasies as pynlike hoofstukke$x$)
 where afrikaans_narration_script like $x$%met beide merkwaardige prestasies en pynlike hoofstukke%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide by die skool en tuis$x$, $x$sowel by die skool as tuis$x$)
 where afrikaans_narration_script like $x$%beide by die skool en tuis%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$eweredig in beide die bo- en onderkant mag deel$x$, $x$eweredig in sowel die bo- as die onderkant mag deel$x$)
 where afrikaans_narration_script like $x$%eweredig in beide die bo- en onderkant mag deel%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$anders as beide 'n plat tekening en 'n volledig afgeronde beeldhouwerk$x$, $x$anders as sowel 'n plat tekening as 'n volledig afgeronde beeldhouwerk$x$)
 where afrikaans_narration_script like $x$%anders as beide 'n plat tekening en 'n volledig afgeronde beeldhouwerk%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Beide similes en metaphors werk deur$x$, $x$Sowel similes as metaphors werk deur$x$)
 where afrikaans_narration_script like $x$%Beide similes en metaphors werk deur%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$Om beide komplementêre kleur en klem te verstaan$x$, $x$Om sowel komplementêre kleur as klem te verstaan$x$)
 where afrikaans_narration_script like $x$%Om beide komplementêre kleur en klem te verstaan%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$deur beide die teller en die noemer met dieselfde getal te vermenigvuldig$x$, $x$deur sowel die teller as die noemer met dieselfde getal te vermenigvuldig$x$)
 where afrikaans_narration_script like $x$%deur beide die teller en die noemer met dieselfde getal te vermenigvuldig%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$Vermenigvuldig beide die boonste en onderste getal met dieselfde getal$x$, $x$Vermenigvuldig sowel die boonste as die onderste getal met dieselfde getal$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%Vermenigvuldig beide die boonste en onderste getal met dieselfde getal%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$goeie geleiers van beide hitte en elektrisiteit$x$, $x$goeie geleiers van sowel hitte as elektrisiteit$x$)
 where afrikaans_narration_script like $x$%goeie geleiers van beide hitte en elektrisiteit%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$om beide die veer se skag en die hoepel gedraai$x$, $x$om sowel die veer se skag as die hoepel gedraai$x$)
 where afrikaans_narration_script like $x$%om beide die veer se skag en die hoepel gedraai%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$-- beide lirieke en melodie --$x$, $x$-- sowel lirieke as melodie --$x$)
 where afrikaans_narration_script like $x$%-- beide lirieke en melodie --%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$waarneming van beide 'n moderne ontwerptradisie (skryfwerk) en 'n tradisionele kulturele een$x$, $x$waarneming van sowel 'n moderne ontwerptradisie (skryfwerk) as 'n tradisionele kulturele een$x$)
 where afrikaans_narration_script like $x$%waarneming van beide 'n moderne ontwerptradisie (skryfwerk) en 'n tradisionele kulturele een%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$gedeel deur beide skryfwerk en Afrika-liggaamsversiering$x$, $x$gedeel deur sowel skryfwerk as Afrika-liggaamsversiering$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%gedeel deur beide skryfwerk en Afrika-liggaamsversiering%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beide vir die individu en vir hul gemeenskap$x$, $x$sowel vir die individu as vir hul gemeenskap$x$)
 where afrikaans_narration_script like $x$%beide vir die individu en vir hul gemeenskap%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$om beide die rykdom wat dit geskep het en die omgewings- en maatskaplike koste$x$, $x$om sowel die rykdom wat dit geskep het as die omgewings- en maatskaplike koste$x$)
 where afrikaans_narration_script like $x$%om beide die rykdom wat dit geskep het en die omgewings- en maatskaplike koste%$x$;
-- One more defect, surfaced by reading these sentences back. The earlier
-- doubled-word check only caught adjacent duplicates, so it missed this:
-- "vinnig" appears on both sides of the infinitive, and "vertel" is stranded
-- in English word order with its object "jou" after the clause.
--   was: vertel om deelbaarheid vinnig te kontroleer jou vinnig watter ...
--   now: vertel 'n vinnige deelbaarheidstoets jou watter ...
-- Checked for more of this shape (same adverb twice within five words) across
-- the corpus: every other hit is deliberate parallel repetition and correct,
-- e.g. "presies dieselfde noot teen presies dieselfde volume".
update public.lessons set afrikaans_narration_script = replace(afrikaans_narration_script,
    $x$vertel om deelbaarheid vinnig te kontroleer jou vinnig watter klein getalle$x$,
    $x$vertel 'n vinnige deelbaarheidstoets jou watter klein getalle$x$)
 where afrikaans_narration_script like $x$%vertel om deelbaarheid vinnig te kontroleer jou vinnig watter klein getalle%$x$;
