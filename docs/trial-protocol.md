# Onboarding trial protocol

Goal: compare how long it takes a student to understand a discontinued project from **raw files** (baseline) versus an **ESTAFET project page**. Run every session the same way so the numbers are comparable. Record results in `/admin/trials`. Never invent or adjust numbers.

Target (not a result): a student understands a project within **30 minutes**.

## Before you start

- Plan about 15 participants, students of Universitas Hasanuddin. Aim for **at least 5 per cohort** (baseline and ESTAFET). With fewer than 5 the admin page refuses to draw a conclusion.
- Give each participant a **pseudonym code** (P01, P02, ...). Keep the list that maps codes to people **outside ESTAFET**. Never type names or emails into the platform.
- Prepare **one project** per pair of sessions, with the same material in both conditions:
  - **Baseline:** the project's raw files in a shared folder (the report PDF, notes, a code folder). No ESTAFET.
  - **ESTAFET:** the project's ESTAFET page (teaser and verified tasks). Use a **real consented project**, or a demo project clearly labeled as demo.
- Write **5 comprehension questions** about the project (objectives, what is done, what is unfinished, why it stopped, one lesson). Use **the same questions and the same answer key** in both cohorts. Keep them fixed for the whole study.

## Consent wording (read aloud, same words every time)

> "We are testing how quickly students can understand a past project. We will time you and ask five questions, and we may ask a short usability questionnaire. We record only a code like P07, not your name. You can stop at any time and your session will not be used. Do you agree to take part and to your anonymous results being included?"

Only if the answer is yes, tick **"Participant consented to being included"** when recording.

## Running a session

1. Give the participant the task: *"Understand this project well enough to explain what it is, what is done, and what a new team should do next."*
2. Start the timer when they first see the material. Do not help.
3. **Timer rule:** stop when the participant says they are ready to answer, or at **60 minutes**, whichever is first. Round to the nearest half minute.
4. Ask the **5 questions** without the material open. Mark each correct or not by the answer key.
5. **Completed** means the participant said they understood within the time limit. If they hit 60 minutes without being ready, record **not completed** (minutes are still recorded but the page's minute statistics use completed sessions only).
6. ESTAFET cohort only: ask them to fill in the 10-item **SUS** questionnaire and record the 0 to 100 score. Leave it empty if they decline.
7. Write short notes on anything unusual (technical problem, interruption). **No personal details.**

## Recording

In **Admin, Trials, Record session**: participant code, cohort, project, start time, minutes, completed, correct and asked, SUS (optional), notes, and the consent checkbox. Mark practice or invented rows as **demo**. Edits are allowed and audited.

## Reading the results

- Every number shows **n**. Demo rows are excluded unless you include them.
- **Median** and **mean** minutes use completed sessions only. **Completion rate** is completed divided by all sessions. **Comprehension score** is the mean share of correct answers.
- **Within 30 minutes** is the share of all ESTAFET sessions that were completed in 30 minutes or less.
- Use the generated **methods and limits** paragraph in the proposal. It states the sample size, that participants are students of one university, and that results are indicative only.
- Do not claim the 30 minute target is met unless the data shows it with enough sessions, and say how many.

## Export

**Download CSV** gives pseudonym codes, cohort, project title, time, minutes, completion, scores and the demo flag. It contains no names or emails.
