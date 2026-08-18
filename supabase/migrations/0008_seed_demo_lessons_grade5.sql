-- Seed: demonstration lesson content for Grade 5 (the flagship demo path referenced
-- throughout the product spec: "Liam", "Grade 5", "Fractions"). Everything inserted
-- here is marked is_demo_content = true and is illustrative only — it has NOT been
-- checked against official CAPS documents and must not be treated as verified
-- curriculum material. It exists so the full learner journey (lesson -> visual demo
-- -> practice -> mini quiz -> mastery result) can be demonstrated end-to-end before
-- real, human-reviewed curriculum content is imported.

do $$
declare
  v_curriculum_id uuid;
  v_grade5_id uuid;
  v_math_id uuid;
  v_eng_id uuid;
  v_term1_id uuid;
  v_topic_fractions uuid;
  v_topic_mult uuid;
  v_topic_reading uuid;
  v_lesson_understanding uuid;
  v_lesson_equivalent uuid;
  v_lesson_equivalent_af uuid;
  v_lesson_mult uuid;
  v_lesson_reading uuid;
  v_q1 uuid;
  v_q2 uuid;
  v_q3 uuid;
  v_q1_af uuid;
  v_q4 uuid;
  v_q5 uuid;
  v_q6 uuid;
  v_q7 uuid;
  v_assessment uuid;
begin
  select id into v_curriculum_id from curricula where code = 'CAPS';
  select id into v_grade5_id from grades where curriculum_id = v_curriculum_id and grade_number = 5;
  select id into v_math_id from subjects where curriculum_id = v_curriculum_id and code = 'MATH';
  select id into v_eng_id from subjects where curriculum_id = v_curriculum_id and code = 'ENG_HL';
  select id into v_term1_id from terms where grade_id = v_grade5_id and term_number = 1;

  -- ===== Topics =====
  insert into topics (subject_id, grade_id, term_id, code, name, description, sort_order, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, 'FRACTIONS', 'Fractions', 'Understanding, comparing and simplifying fractions', 1, true)
  returning id into v_topic_fractions;

  insert into topics (subject_id, grade_id, term_id, code, name, description, sort_order, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, 'MULTIPLICATION', 'Multiplication', 'Multiplying multi-digit numbers with regrouping', 2, true)
  returning id into v_topic_mult;

  insert into topics (subject_id, grade_id, term_id, code, name, description, sort_order, is_demo_content)
  values (v_eng_id, v_grade5_id, v_term1_id, 'READING_COMPREHENSION', 'Reading Comprehension', 'Understanding and interpreting what you read', 1, true)
  returning id into v_topic_reading;

  -- ===== Lesson 1: Understanding Fractions (en) =====
  insert into lessons (topic_id, slug, language, title, estimated_minutes, sort_order, is_demo_content)
  values (v_topic_fractions, 'understanding-fractions', 'en', 'Understanding Fractions', 8, 1, true)
  returning id into v_lesson_understanding;

  insert into lesson_content (lesson_id, section_type, language, heading, body_markdown, sort_order) values
    (v_lesson_understanding, 'what_are_we_learning', 'en', 'What are fractions?', 'Today we are learning what a fraction is and how it shows part of a whole.', 1),
    (v_lesson_understanding, 'simple_explanation', 'en', 'A fraction is part of a whole', 'A fraction has two parts: the top number (numerator) tells us how many parts we have, and the bottom number (denominator) tells us how many equal parts the whole is split into.', 1),
    (v_lesson_understanding, 'simple_explanation', 'en', 'Even simpler', 'Think of a pizza cut into equal slices. If you eat some of the slices, the fraction tells you how many slices you ate out of the total number of slices.', 2),
    (v_lesson_understanding, 'example', 'en', 'Example', 'A chocolate bar has 4 equal pieces. You eat 3 of them. You ate 3/4 of the chocolate bar.', 1),
    (v_lesson_understanding, 'try_it_yourself', 'en', 'Try it yourself', 'Look around you. Can you find something split into equal parts? How would you describe one part as a fraction?', 1),
    (v_lesson_understanding, 'what_did_you_learn', 'en', 'What did you learn?', 'A fraction shows part of a whole: how many parts we have, out of how many equal parts in total.', 1),
    (v_lesson_understanding, 'next_step', 'en', 'Keep going', 'Next, let''s look at equivalent fractions — different fractions that mean the same amount.', 1);

  insert into media (lesson_id, media_type, provider, language, approval_status, age_rating, source)
  values (v_lesson_understanding, 'svg_animation', 'internal', 'en', 'approved', 'all_ages', 'fractions:3:4');

  -- ===== Lesson 2: Equivalent Fractions (en) — the flagship demo lesson with a mini quiz =====
  insert into lessons (topic_id, slug, language, title, estimated_minutes, sort_order, is_demo_content)
  values (v_topic_fractions, 'equivalent-fractions', 'en', 'Equivalent Fractions', 10, 2, true)
  returning id into v_lesson_equivalent;

  insert into lesson_content (lesson_id, section_type, language, heading, body_markdown, sort_order) values
    (v_lesson_equivalent, 'what_are_we_learning', 'en', 'What are equivalent fractions?', 'Today we are learning that different fractions can show the exact same amount.', 1),
    (v_lesson_equivalent, 'simple_explanation', 'en', 'Same amount, different numbers', 'Equivalent fractions look different but represent the same amount. If you multiply or divide the top and bottom of a fraction by the same number, you get an equivalent fraction.', 1),
    (v_lesson_equivalent, 'simple_explanation', 'en', 'Even simpler', 'Half a pizza (1/2) is the same amount as 2 out of 4 slices (2/4) — just cut differently.', 2),
    (v_lesson_equivalent, 'example', 'en', 'Example', '1/2 and 2/4 are equivalent, because 1×2 = 2 and 2×2 = 4.', 1),
    (v_lesson_equivalent, 'try_it_yourself', 'en', 'Try it yourself', 'Can you think of another fraction equivalent to 1/2? Multiply the top and bottom by the same number.', 1),
    (v_lesson_equivalent, 'what_did_you_learn', 'en', 'What did you learn?', 'Multiplying or dividing the numerator and denominator by the same number gives an equivalent fraction.', 1),
    (v_lesson_equivalent, 'next_step', 'en', 'Keep going', 'Great progress! Next, try the Multiplication topic.', 1);

  insert into media (lesson_id, media_type, provider, language, approval_status, age_rating, source)
  values (v_lesson_equivalent, 'svg_animation', 'internal', 'en', 'approved', 'all_ages', 'fractions:2:4');

  -- ===== Lesson 2, Afrikaans translation =====
  insert into lessons (topic_id, slug, language, title, estimated_minutes, sort_order, is_demo_content)
  values (v_topic_fractions, 'equivalent-fractions', 'af', 'Ekwivalente Breuke', 10, 2, true)
  returning id into v_lesson_equivalent_af;

  insert into lesson_content (lesson_id, section_type, language, heading, body_markdown, sort_order) values
    (v_lesson_equivalent_af, 'what_are_we_learning', 'af', 'Wat is ekwivalente breuke?', 'Vandag leer ons dat verskillende breuke presies dieselfde hoeveelheid kan wys.', 1),
    (v_lesson_equivalent_af, 'simple_explanation', 'af', 'Dieselfde hoeveelheid, ander getalle', 'Ekwivalente breuke lyk anders, maar verteenwoordig dieselfde hoeveelheid. As jy die bo- en ondergetal van ''n breuk met dieselfde getal vermenigvuldig of deel, kry jy ''n ekwivalente breuk.', 1),
    (v_lesson_equivalent_af, 'simple_explanation', 'af', 'Nog eenvoudiger', 'Die helfte van ''n pizza (1/2) is dieselfde hoeveelheid as 2 uit 4 snye (2/4) — net anders gesny.', 2),
    (v_lesson_equivalent_af, 'example', 'af', 'Voorbeeld', '1/2 en 2/4 is ekwivalent, want 1×2 = 2 en 2×2 = 4.', 1),
    (v_lesson_equivalent_af, 'try_it_yourself', 'af', 'Probeer dit self', 'Kan jy aan nog ''n breuk dink wat ekwivalent aan 1/2 is? Vermenigvuldig die bo- en ondergetal met dieselfde getal.', 1),
    (v_lesson_equivalent_af, 'what_did_you_learn', 'af', 'Wat het jy geleer?', 'As jy die teller en noemer met dieselfde getal vermenigvuldig of deel, kry jy ''n ekwivalente breuk.', 1),
    (v_lesson_equivalent_af, 'next_step', 'af', 'Gaan voort', 'Goed gedoen! Probeer volgende die Vermenigvuldiging-onderwerp.', 1);

  insert into media (lesson_id, media_type, provider, language, approval_status, age_rating, source)
  values (v_lesson_equivalent_af, 'svg_animation', 'internal', 'af', 'approved', 'all_ages', 'fractions:2:4');

  -- ===== Lesson 3: Multiplying with Regrouping (en) =====
  insert into lessons (topic_id, slug, language, title, estimated_minutes, sort_order, is_demo_content)
  values (v_topic_mult, 'multiplying-with-regrouping', 'en', 'Multiplying with Regrouping', 9, 1, true)
  returning id into v_lesson_mult;

  insert into lesson_content (lesson_id, section_type, language, heading, body_markdown, sort_order) values
    (v_lesson_mult, 'what_are_we_learning', 'en', 'What is regrouping?', 'Today we are learning how place value helps us multiply bigger numbers.', 1),
    (v_lesson_mult, 'simple_explanation', 'en', 'Hundreds, tens and units', 'Every digit in a number has a place value. When we multiply, sometimes a column adds up to more than 9, so we "carry" — or regroup — into the next column.', 1),
    (v_lesson_mult, 'simple_explanation', 'en', 'Even simpler', 'If you have too many units to fit, trade 10 units for 1 ten. If you have too many tens, trade 10 tens for 1 hundred.', 2),
    (v_lesson_mult, 'example', 'en', 'Example', '234 is 2 hundreds, 3 tens and 4 units — that''s 200 + 30 + 4.', 1),
    (v_lesson_mult, 'try_it_yourself', 'en', 'Try it yourself', 'Break the number 456 into hundreds, tens and units.', 1),
    (v_lesson_mult, 'what_did_you_learn', 'en', 'What did you learn?', 'Place value lets us regroup — trade 10 of one column for 1 of the next — when multiplying.', 1),
    (v_lesson_mult, 'next_step', 'en', 'Keep going', 'Well done — try a Reading Comprehension lesson in English next.', 1);

  insert into media (lesson_id, media_type, provider, language, approval_status, age_rating, source)
  values (v_lesson_mult, 'svg_animation', 'internal', 'en', 'approved', 'all_ages', 'place_value:234');

  -- ===== Lesson 4: Finding the Main Idea (English HL, en) =====
  insert into lessons (topic_id, slug, language, title, estimated_minutes, sort_order, is_demo_content)
  values (v_topic_reading, 'finding-the-main-idea', 'en', 'Finding the Main Idea', 7, 1, true)
  returning id into v_lesson_reading;

  insert into lesson_content (lesson_id, section_type, language, heading, body_markdown, sort_order) values
    (v_lesson_reading, 'what_are_we_learning', 'en', 'What is the main idea?', 'Today we are learning how to find the most important idea in a passage.', 1),
    (v_lesson_reading, 'simple_explanation', 'en', 'The big picture', 'The main idea is what the passage is mostly about — the point the writer wants you to understand, not every small detail.', 1),
    (v_lesson_reading, 'simple_explanation', 'en', 'Even simpler', 'Ask yourself: "If I could only say one sentence about this passage, what would it be?" That''s close to the main idea.', 2),
    (v_lesson_reading, 'example', 'en', 'Example', 'A passage about different dog breeds, their sizes and care needs has the main idea: "There are many kinds of dogs, each needing different care."', 1),
    (v_lesson_reading, 'try_it_yourself', 'en', 'Try it yourself', 'Think of a story you read recently. What was its main idea in one sentence?', 1),
    (v_lesson_reading, 'what_did_you_learn', 'en', 'What did you learn?', 'The main idea is the most important point of a passage, not a small supporting detail.', 1),
    (v_lesson_reading, 'next_step', 'en', 'Keep going', 'Great work today across two subjects!', 1);

  -- ===== Questions: Fractions topic (en) =====
  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, v_topic_fractions, 'en', 'easy', 'multiple_choice', 'A pizza is cut into 8 equal slices. You eat 3 slices. What fraction did you eat?', '3/8', '3 slices out of 8 equal slices is written as 3/8.', true)
  returning id into v_q1;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q1, '3/8', true, 1), (v_q1, '8/3', false, 2), (v_q1, '3/5', false, 3), (v_q1, '5/8', false, 4);

  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, v_topic_fractions, 'en', 'medium', 'multiple_choice', 'Which fraction is equivalent to 1/2?', '2/4', 'Multiplying the numerator and denominator of 1/2 by 2 gives 2/4 — the same amount.', true)
  returning id into v_q2;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q2, '2/4', true, 1), (v_q2, '1/4', false, 2), (v_q2, '3/4', false, 3), (v_q2, '2/3', false, 4);

  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, v_topic_fractions, 'en', 'medium', 'multiple_choice', 'Which fraction is equivalent to 3/4?', '6/8', 'Multiplying the numerator and denominator of 3/4 by 2 gives 6/8.', true)
  returning id into v_q3;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q3, '6/8', true, 1), (v_q3, '4/3', false, 2), (v_q3, '3/8', false, 3), (v_q3, '6/4', false, 4);

  -- ===== Questions: Fractions topic (af) — proves the multilingual question bank path =====
  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, v_topic_fractions, 'af', 'easy', 'multiple_choice', '''n Pizza word in 8 gelyke stukke gesny. Jy eet 3 stukke. Watter breuk het jy geëet?', '3/8', '3 stukke uit 8 gelyke stukke word geskryf as 3/8.', true)
  returning id into v_q1_af;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q1_af, '3/8', true, 1), (v_q1_af, '8/3', false, 2), (v_q1_af, '3/5', false, 3), (v_q1_af, '5/8', false, 4);

  -- ===== Questions: Multiplication topic (en) =====
  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, v_topic_mult, 'en', 'easy', 'multiple_choice', 'In the number 234, what is the value of the digit 3?', '30', 'The 3 is in the tens column, so its value is 3 × 10 = 30.', true)
  returning id into v_q4;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q4, '3', false, 1), (v_q4, '30', true, 2), (v_q4, '300', false, 3), (v_q4, '0.3', false, 4);

  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_math_id, v_grade5_id, v_term1_id, v_topic_mult, 'en', 'medium', 'multiple_choice', 'How many tens make one hundred?', '10', '10 groups of ten make 100.', true)
  returning id into v_q5;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q5, '10', true, 1), (v_q5, '100', false, 2), (v_q5, '1', false, 3), (v_q5, '20', false, 4);

  -- ===== Questions: Reading Comprehension topic (en) =====
  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_eng_id, v_grade5_id, v_term1_id, v_topic_reading, 'en', 'easy', 'multiple_choice', 'The main idea of a passage is usually...', 'the most important point the writer wants you to understand', 'The main idea is the big-picture point, not a small detail.', true)
  returning id into v_q6;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q6, 'the most important point the writer wants you to understand', true, 1),
    (v_q6, 'the very last sentence, always', false, 2),
    (v_q6, 'a small detail mentioned once', false, 3),
    (v_q6, 'the title, no matter what', false, 4);

  insert into questions (subject_id, grade_id, term_id, topic_id, language, difficulty, question_type, prompt, correct_answer, explanation, is_demo_content)
  values (v_eng_id, v_grade5_id, v_term1_id, v_topic_reading, 'en', 'medium', 'multiple_choice', 'A good way to find the main idea is to ask yourself...', 'What is this passage mostly about?', 'Asking what the passage is mostly about helps you separate the main idea from small details.', true)
  returning id into v_q7;
  insert into question_options (question_id, label, is_correct, sort_order) values
    (v_q7, 'What is this passage mostly about?', true, 1),
    (v_q7, 'How many words are in this passage?', false, 2),
    (v_q7, 'What is the last word of the passage?', false, 3),
    (v_q7, 'Who published this passage?', false, 4);

  -- ===== Mini quiz assessment for the flagship "Equivalent Fractions" lesson =====
  insert into assessments (type, title, language, subject_id, grade_id, term_id, topic_id, lesson_id, is_demo_content)
  values ('mini_quiz', 'Equivalent Fractions Mini Quiz', 'en', v_math_id, v_grade5_id, v_term1_id, v_topic_fractions, v_lesson_equivalent, true)
  returning id into v_assessment;

  insert into assessment_questions (assessment_id, question_id, sort_order) values
    (v_assessment, v_q2, 1),
    (v_assessment, v_q3, 2);
end $$;
