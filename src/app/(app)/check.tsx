import { useAction } from 'convex/react';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { Banner, Button, Chip, IconBubble, IconButton, OptionRow, ProgressBar, Screen, T, type IconName } from '@/components/ui';
import { C, R, S } from '@/constants/theme';
import { errorMessage } from '@/lib/format';
import { useUserId } from '@/lib/session';
import { api } from '@convex/_generated/api';
import {
  BENEFITS,
  COOKING,
  DIETARY,
  ENERGY,
  FOOD_AT_HOME,
  INCOME,
  REASONS,
  type Answers,
  type Option,
} from '@convex/lib/questions';

type StepDef =
  | { kind: 'household'; title: string; help?: string }
  | { kind: 'single'; key: keyof Answers; title: string; help?: string; options: Option[] }
  | { kind: 'multi'; key: 'reasons' | 'benefits' | 'dietary'; title: string; help?: string; options: Option[]; exclusive?: string }
  | { kind: 'text'; title: string; help?: string };

const STEPS: StepDef[] = [
  { kind: 'household', title: 'Who lives with you?', help: 'Count everyone you buy food for, including you.' },
  { kind: 'multi', key: 'reasons', title: 'What’s making things hard right now?', help: 'Choose all that apply.', options: REASONS },
  { kind: 'multi', key: 'benefits', title: 'Does anyone in your home get these?', help: 'Choose all that apply.', options: BENEFITS, exclusive: 'none' },
  { kind: 'single', key: 'income', title: 'How much money comes in each month, after rent?', help: 'For your whole household, a rough guess is fine.', options: INCOME },
  { kind: 'single', key: 'foodAtHome', title: 'How much food do you have at home?', options: FOOD_AT_HOME },
  { kind: 'single', key: 'cooking', title: 'How can you cook at the moment?', help: 'This helps us suggest the right food.', options: COOKING },
  { kind: 'multi', key: 'dietary', title: 'Any food needs we should know about?', options: DIETARY, exclusive: 'none' },
  { kind: 'single', key: 'energy', title: 'How are you doing with gas and electricity?', options: ENERGY },
  { kind: 'text', title: 'Anything else you’d like to tell us?', help: 'Optional. In your own words, so you don’t have to repeat it to an adviser.' },
];

const EMPTY: Answers = {
  adults: 1,
  children: 0,
  reasons: [],
  benefits: [],
  income: '',
  foodAtHome: '',
  cooking: '',
  dietary: [],
  energy: '',
  postcode: '',
  story: '',
};

type FollowUp = { question: string; suggestions: string[]; answer: string };
type Phase = 'questions' | 'thinking' | 'followups' | 'submitting';

export default function Check() {
  const userId = useUserId();
  const getFollowUps = useAction(api.assessments.followUps);
  const assess = useAction(api.assessments.assess);

  const [phase, setPhase] = useState<Phase>('questions');
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [fuStep, setFuStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [step, fuStep, phase, fade]);

  const def = STEPS[step];
  const totalSteps = STEPS.length + 1; // +1 for the AI follow-up stage
  const progress = phase === 'questions' ? step / totalSteps : (STEPS.length + (followUps.length ? fuStep / followUps.length : 1)) / totalSteps;

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((a) => ({ ...a, [key]: value }));
  }

  const stepComplete = (() => {
    if (!def) return true;
    switch (def.kind) {
      case 'household': return answers.adults >= 1;
      case 'single': return Boolean(answers[def.key]);
      case 'multi': return answers[def.key].length > 0;
      case 'text': return true;
    }
  })();

  function back() {
    setError(null);
    if (phase === 'followups') {
      if (fuStep > 0) return setFuStep(fuStep - 1);
      setPhase('questions');
      return;
    }
    if (step === 0) return router.back();
    setStep(step - 1);
  }

  async function next() {
    setError(null);
    if (step < STEPS.length - 1) return setStep(step + 1);
    setPhase('thinking');
    const qs = await getFollowUps({ answers }).catch(() => []);
    if (qs.length) {
      setFollowUps(qs.map((q) => ({ ...q, answer: '' })));
      setFuStep(0);
      setPhase('followups');
    } else {
      submit([]);
    }
  }

  async function submit(fus: FollowUp[]) {
    setPhase('submitting');
    try {
      const id = await assess({
        userId,
        answers,
        followUps: fus.map(({ question, answer }) => ({ question, answer })),
      });
      router.replace(`/result/${id}`);
    } catch (err) {
      setError(errorMessage(err));
      setPhase(fus.length ? 'followups' : 'questions');
    }
  }

  function nextFollowUp() {
    if (fuStep < followUps.length - 1) setFuStep(fuStep + 1);
    else submit(followUps);
  }

  if (phase === 'thinking' || phase === 'submitting') {
    return <Working phase={phase} />;
  }

  const header = (
    <View style={styles.topBar}>
      <IconButton name={step === 0 && phase === 'questions' ? 'close' : 'arrow-back'} label="Back" onPress={back} />
      <ProgressBar value={progress} />
      <T kind="small" muted style={{ width: 44, textAlign: 'right' }}>
        {phase === 'questions' ? `${step + 1}/${totalSteps}` : `${totalSteps}/${totalSteps}`}
      </T>
    </View>
  );

  if (phase === 'followups') {
    const fu = followUps[fuStep];
    const setAnswer = (answer: string) =>
      setFollowUps((list) => list.map((f, i) => (i === fuStep ? { ...f, answer } : f)));
    return (
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen
          header={header}
          footer={
            <View style={{ gap: S.sm }}>
              <Button title={fuStep < followUps.length - 1 ? 'Next' : 'See what I can get'} icon="arrow-forward" onPress={nextFollowUp} disabled={!fu.answer.trim()} />
              <Button title="Skip this question" variant="ghost" onPress={() => { setAnswer(''); nextFollowUp(); }} />
            </View>
          }>
          <Animated.View style={{ opacity: fade, gap: S.xl }}>
            <View style={styles.aiTag}>
              <IconBubble name="sparkles" size={28} />
              <T kind="small" style={{ color: C.primary, fontWeight: '700' }}>
                A quick follow-up · {fuStep + 1} of {followUps.length}
              </T>
            </View>
            <T kind="title">{fu.question}</T>
            {fu.suggestions.length ? (
              <View style={styles.chips}>
                {fu.suggestions.map((s) => (
                  <Chip key={s} label={s} selected={fu.answer === s} onPress={() => setAnswer(s)} />
                ))}
              </View>
            ) : null}
            <TextInput
              value={fu.suggestions.includes(fu.answer) ? '' : fu.answer}
              onChangeText={setAnswer}
              placeholder="Or type your answer"
              placeholderTextColor={C.faint}
              style={styles.input}
            />
            {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
          </Animated.View>
        </Screen>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen
        header={header}
        footer={<Button title={step === STEPS.length - 1 ? 'Continue' : 'Next'} icon="arrow-forward" onPress={next} disabled={!stepComplete} />}>
        <Animated.View style={{ opacity: fade, gap: S.xl }}>
          <View style={{ gap: S.sm }}>
            <T kind="title">{def.title}</T>
            {def.help ? <T muted>{def.help}</T> : null}
          </View>

          {def.kind === 'household' ? (
            <View style={{ gap: S.md }}>
              <Counter icon="person" label="Adults" sub="16 and over" value={answers.adults} min={1} onChange={(n) => set('adults', n)} />
              <Counter icon="happy" label="Children" sub="Under 16" value={answers.children} min={0} onChange={(n) => set('children', n)} />
            </View>
          ) : null}

          {def.kind === 'single' ? (
            <View style={{ gap: S.sm + 2 }}>
              {def.options.map((o) => (
                <OptionRow
                  key={o.id}
                  label={o.label}
                  hint={o.hint}
                  selected={answers[def.key] === o.id}
                  onPress={() => {
                    set(def.key, o.id as never);
                    setTimeout(() => setStep((s) => (s === step ? Math.min(s + 1, STEPS.length - 1) : s)), 260);
                  }}
                />
              ))}
            </View>
          ) : null}

          {def.kind === 'multi' ? (
            <View style={{ gap: S.sm + 2 }}>
              {def.options.map((o) => {
                const list = answers[def.key];
                const selected = list.includes(o.id);
                return (
                  <OptionRow
                    key={o.id}
                    multi
                    label={o.label}
                    hint={o.hint}
                    selected={selected}
                    onPress={() => {
                      let nextList = selected ? list.filter((x) => x !== o.id) : [...list, o.id];
                      if (def.exclusive && !selected) {
                        nextList = o.id === def.exclusive ? [o.id] : nextList.filter((x) => x !== def.exclusive);
                      }
                      set(def.key, nextList);
                    }}
                  />
                );
              })}
            </View>
          ) : null}

          {def.kind === 'text' ? (
            <View style={{ gap: S.lg }}>
              <View style={{ gap: S.sm }}>
                <T kind="label">First part of your postcode</T>
                <TextInput
                  value={answers.postcode}
                  onChangeText={(t) => set('postcode', t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4))}
                  placeholder="e.g. LS7"
                  placeholderTextColor={C.faint}
                  autoCapitalize="characters"
                  style={[styles.input, { width: 140 }]}
                />
              </View>
              <View style={{ gap: S.sm }}>
                <T kind="label">Your situation</T>
                <TextInput
                  value={answers.story}
                  onChangeText={(t) => set('story', t.slice(0, 600))}
                  placeholder="For example: my Universal Credit is late after I moved, and my kids need feeding this weekend."
                  placeholderTextColor={C.faint}
                  multiline
                  textAlignVertical="top"
                  style={[styles.input, styles.textarea]}
                />
                <T kind="small" muted style={{ alignSelf: 'flex-end' }}>{answers.story.length}/600</T>
              </View>
            </View>
          ) : null}

          {error ? <Banner tone="danger" icon="alert-circle">{error}</Banner> : null}
        </Animated.View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Counter({ icon, label, sub, value, min, onChange }: {
  icon: IconName;
  label: string;
  sub: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.counter}>
      <IconBubble name={icon} size={44} />
      <View style={{ flex: 1 }}>
        <T kind="label">{label}</T>
        <T kind="small" muted>{sub}</T>
      </View>
      <View style={styles.counterControls}>
        <IconButton name="remove" label={`Fewer ${label.toLowerCase()}`} onPress={() => onChange(Math.max(min, value - 1))} />
        <T kind="heading" style={{ minWidth: 28, textAlign: 'center' }}>{value}</T>
        <IconButton name="add" label={`More ${label.toLowerCase()}`} onPress={() => onChange(Math.min(12, value + 1))} />
      </View>
    </View>
  );
}

const WORKING_LINES = {
  thinking: ['Reading your answers…', 'Checking if anything’s missing…'],
  submitting: ['Checking what you can get…', 'Looking for other help near you…', 'Writing your summary…'],
};

function Working({ phase }: { phase: 'thinking' | 'submitting' }) {
  const lines = WORKING_LINES[phase];
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => Math.min(n + 1, lines.length - 1)), 1600);
    return () => clearInterval(t);
  }, [lines.length]);
  return (
    <Screen scroll={false}>
      <View style={styles.working}>
        <View style={styles.workingRing}>
          <ActivityIndicator size="large" color={C.primary} />
        </View>
        <T kind="heading" center>{lines[i]}</T>
        <T muted center>This only takes a moment.</T>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: S.md },
  input: {
    backgroundColor: C.surface,
    borderWidth: 1.5,
    borderColor: C.border,
    borderRadius: R.md,
    paddingHorizontal: S.lg,
    minHeight: 54,
    fontSize: 17,
    color: C.text,
  },
  textarea: { minHeight: 140, paddingTop: S.md, paddingBottom: S.md, lineHeight: 23 },
  counter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: S.md,
    backgroundColor: C.surface,
    borderRadius: R.md,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: S.md,
    paddingLeft: S.lg,
  },
  counterControls: { flexDirection: 'row', alignItems: 'center', gap: S.xs, backgroundColor: C.bg, borderRadius: R.pill, padding: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: S.sm },
  aiTag: { flexDirection: 'row', alignItems: 'center', gap: S.sm },
  working: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: S.md, paddingBottom: 80 },
  workingRing: { width: 88, height: 88, borderRadius: 44, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: S.md },
});
