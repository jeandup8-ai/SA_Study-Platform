-- Afrikaans grammar, spelling and mistranslation corrections.
--
-- Found by a mechanical sweep over every Afrikaans field on every lesson
-- (3 965 text chunks / 7 758 sentences): negation closure, the 'n apostrophe,
-- missing diacritics, doubled words, English leakage, broken words, and
-- calques. Every machine flag was then read by hand -- most were false
-- positives (e.g. "kan ly", "in ag neem", "yl" and algebraic "n" are all
-- correct, and "nie ... nie en" closes the clause properly). What follows is
-- only what was actually wrong.
--
-- 1. ná vs na. "ná" (with the acute accent) means "after"; "na" means "to,
--    towards". A Grade 5 decimals lesson said "syfers na die komma" 10 times,
--    which reads as "digits towards the comma".
-- 2. silhoeet takes no diaeresis.
-- 3. One word had been split in two: "waterval le" for "watervalle".
-- 4. "striking physical features" had become "opspraakwekkende" -- that means
--    sensational or scandalous, not striking.
-- 5. "<noun> die moeite werd om ..." in 15 places. Afrikaans has no reduced
--    relative clause here; it needs "wat ... is". "Dit is (ook) die moeite
--    werd om ..." is correct and is left alone -- that is the majority.
-- 6. Six further calques and awkward constructions, listed at each statement.
--
-- Deliberately NOT changed: "beide" (48 uses). The AWS allows it; preferring
-- "albei" is a house-style call, not a correction, and is the user's to make.

-- 1. ná (after), not na (towards).
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$na die komma$x$, $x$ná die komma$x$)
 where afrikaans_narration_script like $x$%na die komma%$x$;

update public.lessons set afrikaans_visual_storyboard =
  replace(afrikaans_visual_storyboard::text, $x$na die komma$x$, $x$ná die komma$x$)::jsonb
 where afrikaans_visual_storyboard::text like $x$%na die komma%$x$;

update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text, $x$na die komma$x$, $x$ná die komma$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%na die komma%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$voor en na $x$, $x$voor en ná $x$)
 where afrikaans_narration_script like $x$%voor en na %$x$;

-- 2. silhoeet, not silhoeët.
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$silhoeët$x$, $x$silhoeet$x$)
 where afrikaans_narration_script like $x$%silhoeët%$x$;

update public.lessons set afrikaans_visual_storyboard =
  replace(afrikaans_visual_storyboard::text, $x$silhoeët$x$, $x$silhoeet$x$)::jsonb
 where afrikaans_visual_storyboard::text like $x$%silhoeët%$x$;

-- 3. A word split in two, in Grade 5 "Physical features of South Africa".
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$waterval le,$x$, $x$watervalle,$x$)
 where afrikaans_narration_script like $x$%waterval le,%$x$;

-- 4. "striking" -> treffend, not opspraakwekkend (sensational/scandalous).
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$opspraakwekkende$x$, $x$treffende$x$)
 where afrikaans_narration_script like $x$%opspraakwekkende%$x$;

-- 5. "<noun> die moeite werd om ..." needs "wat ... is".
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$besonderheid die moeite werd om$x$, $x$besonderheid wat die moeite werd is om$x$)
 where afrikaans_narration_script like $x$%besonderheid die moeite werd om%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$gewoonte die moeite werd om nou te bou$x$, $x$gewoonte wat die moeite werd is om nou te bou$x$)
 where afrikaans_narration_script like $x$%gewoonte die moeite werd om nou te bou%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$gewoonte die moeite werd om te hê$x$, $x$gewoonte wat die moeite werd is om te hê$x$)
 where afrikaans_narration_script like $x$%gewoonte die moeite werd om te hê%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$gewoonte die moeite werd om te bou$x$, $x$gewoonte wat die moeite werd is om te bou$x$)
 where afrikaans_narration_script like $x$%gewoonte die moeite werd om te bou%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$gewoonte die moeite werd om na elke toets$x$, $x$gewoonte wat die moeite werd is om na elke toets$x$)
 where afrikaans_narration_script like $x$%gewoonte die moeite werd om na elke toets%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$hulpmiddel is die moeite werd om regtig te probeer$x$, $x$hulpmiddel is wat die moeite werd is om regtig te probeer$x$)
 where afrikaans_narration_script like $x$%hulpmiddel is die moeite werd om regtig te probeer%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$punt die moeite werd om te onthou$x$, $x$punt wat die moeite werd is om te onthou$x$)
 where afrikaans_narration_script like $x$%punt die moeite werd om te onthou%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$kenmerke die moeite werd om by naam te ken$x$, $x$kenmerke wat die moeite werd is om by naam te ken$x$)
 where afrikaans_narration_script like $x$%kenmerke die moeite werd om by naam te ken%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$maniere die moeite werd om van te leer$x$, $x$maniere wat die moeite werd is om van te leer$x$)
 where afrikaans_narration_script like $x$%maniere die moeite werd om van te leer%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$reëls die moeite werd om vir 3$x$, $x$reëls wat die moeite werd is om vir 3$x$)
 where afrikaans_narration_script like $x$%reëls die moeite werd om vir 3%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$behandel die moeite werd om doelbewus te oefen$x$, $x$behandel wat die moeite werd is om doelbewus te oefen$x$)
 where afrikaans_narration_script like $x$%behandel die moeite werd om doelbewus te oefen%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$idee die moeite werd om te onthou$x$, $x$idee wat die moeite werd is om te onthou$x$)
 where afrikaans_narration_script like $x$%idee die moeite werd om te onthou%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$patroon die moeite werd om in enige vaardigheid$x$, $x$patroon wat die moeite werd is om in enige vaardigheid$x$)
 where afrikaans_narration_script like $x$%patroon die moeite werd om in enige vaardigheid%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$iets die moeite werd om oor jou eie lewe te oordink$x$, $x$iets wat die moeite werd is om oor jou eie lewe te oordink$x$)
 where afrikaans_narration_script like $x$%iets die moeite werd om oor jou eie lewe te oordink%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script, $x$beginwaarnemings, die moeite werd om te toets$x$, $x$beginwaarnemings wat die moeite werd is om te toets$x$)
 where afrikaans_narration_script like $x$%beginwaarnemings, die moeite werd om te toets%$x$;

-- 6a. "we turn our skills to X" calqued as "draai ons ... na"; and the compound
--     geletterdheidsvaardighede is written solid, not hyphenated.
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$draai ons ons visuele geletterdheid-vaardighede na die natuurlike wêreld$x$,
    $x$rig ons ons visuele geletterdheidsvaardighede op die natuurlike wêreld$x$)
 where afrikaans_narration_script like $x$%draai ons ons visuele geletterdheid-vaardighede na die natuurlike wêreld%$x$;

-- 6b. "voor voor" -- the particle of voorberei collided with the preposition.
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$berei jou stem en liggaam voor voor 'n opvoering$x$,
    $x$berei jou stem en liggaam vir 'n opvoering voor$x$)
 where afrikaans_narration_script like $x$%berei jou stem en liggaam voor voor 'n opvoering%$x$;

-- 6c. "Verbeel jou jou ..." -- add the complementiser so the two "jou" separate.
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$Verbeel jou jou straattoneel het drie figure:$x$,
    $x$Verbeel jou dat jou straattoneel drie figure het:$x$)
 where afrikaans_narration_script like $x$%Verbeel jou jou straattoneel het drie figure:%$x$;

-- 6d. "think through X ... further" calqued with a stranded "verder".
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$Kom ons dink deur die 'geen korrekte antwoord'-idee 'n bietjie verder$x$,
    $x$Kom ons dink 'n bietjie verder oor die 'geen korrekte antwoord'-idee$x$)
 where afrikaans_narration_script like $x$%Kom ons dink deur die 'geen korrekte antwoord'-idee 'n bietjie verder%$x$;

-- 6e. An English cleft ("reflecting ... is what really drives ...") carried
--     straight into Afrikaans, where it does not parse. Also na -> ná here.
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$terwyl om eerlik te reflekteer, selfs kortliks, na elke poging is wat werklik ware verbetering oor 'n kwartaal aandryf.$x$,
    $x$terwyl eerlike refleksie ná elke poging, al is dit kortliks, werklik ware verbetering oor 'n kwartaal aandryf.$x$)
 where afrikaans_narration_script like $x$%terwyl om eerlik te reflekteer, selfs kortliks, na elke poging is wat werklik ware verbetering%$x$;

-- 6f. "Think about both what NOT to do and ..." -- "beide X en Y" does not work
--     across a clause like this; Afrikaans uses "sowel X as Y".
update public.lessons set afrikaans_practice_questions =
  replace(afrikaans_practice_questions::text,
    $x$Dink aan beide wat NIE om te doen nie en watter positiewe optrede om te neem.$x$,
    $x$Dink aan sowel wat jy NIE moet doen nie as watter positiewe stappe jy kan neem.$x$)::jsonb
 where afrikaans_practice_questions::text like $x$%Dink aan beide wat NIE om te doen nie en watter positiewe optrede om te neem.%$x$;

-- 6g. Same defect class as 5, with an adjective instead of "die moeite werd":
--     "something true of X" needs "iets wat van X waar is", not "iets waar van X".
--     ("baie regte" -> "baie werklike" in the same sentence; regte means
--     right/correct, not real.)
update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$Dit weerspieël iets waar van baie regte ontwerp- en ingenieursloopbane:$x$,
    $x$Dit weerspieël iets wat van baie werklike ontwerp- en ingenieursloopbane waar is:$x$)
 where afrikaans_narration_script like $x$%Dit weerspieël iets waar van baie regte ontwerp- en ingenieursloopbane:%$x$;

update public.lessons set afrikaans_narration_script =
  replace(afrikaans_narration_script,
    $x$Dit weerspieël iets waar van amper enige kreatiewe vaardigheid:$x$,
    $x$Dit weerspieël iets wat van byna enige kreatiewe vaardigheid waar is:$x$)
 where afrikaans_narration_script like $x$%Dit weerspieël iets waar van amper enige kreatiewe vaardigheid:%$x$;
