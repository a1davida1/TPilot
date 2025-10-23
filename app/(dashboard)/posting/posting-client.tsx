'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';

const PERSONA_OPTIONS = [
  { value: 'flirty_playful', label: 'Flirty Playful (SFW)' },
  { value: 'gamer_nerdy', label: 'Gamer Nerdy (SFW)' },
  { value: 'luxury_minimal', label: 'Luxury Minimal (SFW)' },
  { value: 'arts_muse', label: 'Arts Muse (SFW)' },
  { value: 'gym_energy', label: 'Gym Energy (SFW)' },
  { value: 'cozy_girl', label: 'Cozy Girl (SFW)' },
  { value: 'seductive_goddess', label: 'Seductive Goddess (NSFW)' },
  { value: 'intimate_girlfriend', label: 'Intimate Girlfriend (NSFW)' },
  { value: 'bratty_tease', label: 'Bratty Tease (NSFW)' },
  { value: 'submissive_kitten', label: 'Submissive Kitten (NSFW)' },
] as const;

type PersonaValue = typeof PERSONA_OPTIONS[number]['value'];
type ToneToggle = 'story' | 'question' | 'tease' | 'promo' | 'urgent';

const TONE_TOGGLES: ReadonlyArray<{ id: ToneToggle; label: string; helper: string }> = [
  { id: 'story', label: 'Story arc', helper: 'Add a narrative hook that references the visual details.' },
  { id: 'question', label: 'Ask a question', helper: 'Prompt comments with an open-ended question.' },
  { id: 'tease', label: 'Playful tease', helper: 'Lean into teasing language that leaves a cliffhanger.' },
  { id: 'promo', label: 'Soft promo', helper: 'Add a subtle promotional nudge without feeling salesy.' },
  { id: 'urgent', label: 'Urgency', helper: 'Create a gentle sense of urgency or limited-time vibe.' },
];

interface TargetFormState {
  id: string;
  subreddit: string;
  persona: PersonaValue;
  tones: ToneToggle[];
}

interface ApiVariantSuggestion {
  caption: string;
  alt?: string;
  hashtags?: string[];
  cta?: string;
  mood?: string;
  style?: string;
  nsfw?: boolean;
  titles: string[];
}

interface ApiVariantResponse {
  variantId: number;
  subreddit: string;
  persona: string;
  tones: string[];
  suggestion: ApiVariantSuggestion;
  ranked: unknown;
  variants: unknown;
  createdAt: string;
}

interface StoredVariantResponse {
  id: number;
  subreddit: string;
  persona: string | null;
  tones: string[];
  finalCaption: string;
  finalAlt: string | null;
  finalCta: string | null;
  hashtags: string[];
  rankedMetadata: unknown;
  imageUrl: string;
  imageId: number | null;
  createdAt: string | null;
}

interface VariantCardData {
  id: number;
  subreddit: string;
  persona?: string | null;
  tones: string[];
  caption: string;
  alt?: string | null;
  cta?: string | null;
  hashtags: string[];
  imageUrl: string;
  createdAt?: string | null;
  nsfw?: boolean;
  isNew: boolean;
}

interface VariantOverride {
  scheduleAt?: string;
  flairId?: string;
  flairText?: string;
  nsfw?: boolean;
}

interface RateLimitInfo {
  tier: string;
  remaining: number;
  resetAt: string;
}

const containerClass = 'mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10';
const cardClass = 'rounded-lg border border-gray-200 bg-white p-5 shadow-sm';
const labelClass = 'block text-sm font-medium text-gray-700';
const inputClass = 'mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
const sectionTitleClass = 'text-lg font-semibold text-gray-900';
const chipClass = 'inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700';

function createTarget(defaultPersona: PersonaValue): TargetFormState {
  const uniqueId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return { id: uniqueId, subreddit: '', persona: defaultPersona, tones: [] };
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function classNames(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function PostingClient() {
  const [imageUrl, setImageUrl] = useState('');
  const [imageId, setImageId] = useState('');
  const [nsfw, setNsfw] = useState(false);
  const [targets, setTargets] = useState<TargetFormState[]>([createTarget(nsfw ? 'seductive_goddess' : 'flirty_playful')]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [variants, setVariants] = useState<ApiVariantResponse[]>([]);
  const [drafts, setDrafts] = useState<StoredVariantResponse[]>([]);
  const [draftLoading, setDraftLoading] = useState(true);
  const [draftError, setDraftError] = useState<string | null>(null);
  const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
  const [overrides, setOverrides] = useState<Record<number, VariantOverride>>({});
  const [throttleMs, setThrottleMs] = useState(2000);
  const [postLoading, setPostLoading] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const loadDrafts = async () => {
      try {
        const response = await fetch('/api/ai/generate/variants', { credentials: 'include', signal: controller.signal });
        if (!response.ok) throw new Error('Failed to load saved variants');
        const data = (await response.json()) as { success: boolean; variants: StoredVariantResponse[] };
        if (data.success) setDrafts(data.variants);
      } catch (loadError) {
        if ((loadError as DOMException).name === 'AbortError') return;
        setDraftError(loadError instanceof Error ? loadError.message : 'Unable to load saved variants');
      } finally {
        setDraftLoading(false);
      }
    };
    void loadDrafts();
    return () => controller.abort();
  }, []);

  const handlePersonaChange = useCallback((targetId: string, persona: PersonaValue) => {
    setTargets(previous => previous.map(target => (target.id === targetId ? { ...target, persona } : target)));
  }, []);

  const handleSubredditChange = useCallback((targetId: string, value: string) => {
    setTargets(previous => previous.map(target => (target.id === targetId ? { ...target, subreddit: value } : target)));
  }, []);

  const handleToneToggle = useCallback((targetId: string, tone: ToneToggle) => {
    setTargets(previous => previous.map(target => {
      if (target.id !== targetId) return target;
      const hasTone = target.tones.includes(tone);
      return { ...target, tones: hasTone ? target.tones.filter(item => item !== tone) : [...target.tones, tone] };
    }));
  }, []);

  const handleAddTarget = useCallback(() => {
    setTargets(previous => [...previous, createTarget(nsfw ? 'seductive_goddess' : 'flirty_playful')]);
  }, [nsfw]);

  const handleRemoveTarget = useCallback((targetId: string) => {
    setTargets(previous => (previous.length === 1 ? previous : previous.filter(target => target.id !== targetId)));
  }, []);

  const combinedVariants = useMemo<VariantCardData[]>(() => {
    const map = new Map<number, VariantCardData>();
    for (const draft of drafts) {
      map.set(draft.id, {
        id: draft.id, subreddit: draft.subreddit, persona: draft.persona, tones: draft.tones ?? [],
        caption: draft.finalCaption, alt: draft.finalAlt, cta: draft.finalCta, hashtags: draft.hashtags ?? [],
        imageUrl: draft.imageUrl, createdAt: draft.createdAt, isNew: false,
      });
    }
    for (const generated of variants) {
      map.set(generated.variantId, {
        id: generated.variantId, subreddit: generated.subreddit, persona: generated.persona, tones: generated.tones,
        caption: generated.suggestion.caption, alt: generated.suggestion.alt ?? null, cta: generated.suggestion.cta ?? null,
        hashtags: generated.suggestion.hashtags ?? [], imageUrl: currentImageUrl, createdAt: generated.createdAt,
        nsfw: generated.suggestion.nsfw, isNew: true,
      });
    }
    return Array.from(map.values()).sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });
  }, [drafts, variants, currentImageUrl]);

  const handleGenerate = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    if (!imageUrl.trim()) { setLoading(false); setError('Please provide an image URL to generate captions.'); return; }
    const preparedTargets = targets.map(target => ({ id: target.id, subreddit: target.subreddit.trim(), persona: target.persona, tones: target.tones })).filter(target => target.subreddit.length > 0);
    if (preparedTargets.length === 0) { setLoading(false); setError('Add at least one subreddit target before generating captions.'); return; }
    try {
      const response = await fetch('/api/ai/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ imageUrl: imageUrl.trim(), imageId: imageId ? Number(imageId) : undefined, platform: 'reddit', nsfw, targets: preparedTargets.map(target => ({ subreddit: target.subreddit, persona: target.persona, tones: target.tones })) }),
      });
      if (response.status === 429) { const body = await response.json(); throw new Error(body?.error ?? 'Caption generation rate limit reached.'); }
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body?.error ?? 'Failed to generate captions.'); }
      const data = (await response.json()) as { success: boolean; data: { imageUrl: string; imageId: number | null; tier: string; rateLimit: { remaining: number; resetAt: string }; variants: ApiVariantResponse[] } };
      if (!data.success) throw new Error('Generation request failed.');
      setCurrentImageUrl(data.data.imageUrl);
      setVariants(data.data.variants);
      setSuccess(`Generated ${data.data.variants.length} caption${data.data.variants.length === 1 ? '' : 's'}.`);
      setRateLimitInfo({ tier: data.data.tier, remaining: data.data.rateLimit.remaining, resetAt: data.data.rateLimit.resetAt });
      setDrafts(previous => {
        const next = new Map(previous.map(item => [item.id, item] as const));
        for (const variant of data.data.variants) {
          next.set(variant.variantId, { id: variant.variantId, subreddit: variant.subreddit, persona: variant.persona, tones: variant.tones, finalCaption: variant.suggestion.caption, finalAlt: variant.suggestion.alt ?? null, finalCta: variant.suggestion.cta ?? null, hashtags: variant.suggestion.hashtags ?? [], rankedMetadata: variant.ranked, imageUrl: data.data.imageUrl, imageId: data.data.imageId, createdAt: variant.createdAt });
        }
        return Array.from(next.values());
      });
      setSelectedVariants(previous => { const next = new Set(previous); for (const variant of data.data.variants) { next.add(variant.variantId); } return next; });
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unable to generate captions.');
    } finally {
      setLoading(false);
    }
  }, [imageId, imageUrl, nsfw, targets]);

  const handleVariantSelection = useCallback((variantId: number) => {
    setSelectedVariants(previous => { const next = new Set(previous); if (next.has(variantId)) { next.delete(variantId); } else { next.add(variantId); } return next; });
  }, []);

  const handleOverrideChange = useCallback(<K extends keyof VariantOverride>(variantId: number, key: K, value: VariantOverride[K]) => {
    setOverrides(previous => ({ ...previous, [variantId]: { ...previous[variantId], [key]: value } }));
  }, []);

  const handlePost = useCallback(async () => {
    setPostError(null);
    setPostSuccess(null);
    const selected = Array.from(selectedVariants);
    if (selected.length === 0) { setPostError('Select at least one caption variant to post.'); return; }
    const variantRequests = [] as Array<{ variantId: number; scheduleAt?: string; flairId?: string; flairText?: string; nsfw?: boolean }>;
    for (const variantId of selected) {
      const override = overrides[variantId];
      let scheduleIso: string | undefined;
      if (override?.scheduleAt) {
        const parsed = new Date(override.scheduleAt);
        if (Number.isNaN(parsed.getTime())) { setPostError('One of the scheduling fields contains an invalid date.'); return; }
        scheduleIso = parsed.toISOString();
      }
      variantRequests.push({ variantId, scheduleAt: scheduleIso, flairId: override?.flairId?.trim() ? override.flairId.trim() : undefined, flairText: override?.flairText?.trim() ? override.flairText.trim() : undefined, nsfw: typeof override?.nsfw === 'boolean' ? override.nsfw : undefined });
    }
    setPostLoading(true);
    try {
      const response = await fetch('/api/reddit/post', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ variantRequests, throttleMs }) });
      const body = await response.json().catch(() => ({ success: false, error: 'Failed to parse server response.' }));
      if (!response.ok) throw new Error(body?.error ?? 'Failed to post to Reddit.');
      if (!body.success) throw new Error(body?.error ?? 'Posting did not succeed.');
      const postedCount = (body.results as Array<{ status: string }> | undefined)?.filter(item => item.status === 'success').length ?? 0;
      setPostSuccess(`Queued ${postedCount} submission${postedCount === 1 ? '' : 's'} for Reddit.`);
    } catch (postErr) {
      setPostError(postErr instanceof Error ? postErr.message : 'Unable to post captions to Reddit.');
    } finally {
      setPostLoading(false);
    }
  }, [overrides, selectedVariants, throttleMs]);

  const personaDefault = nsfw ? 'seductive_goddess' : 'flirty_playful';
  useEffect(() => {
    setTargets(previous => previous.map(target => ({ ...target, persona: target.persona ?? personaDefault })));
  }, [personaDefault]);

  return (
    <div className={containerClass}>
      <section className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-gray-900">Multi-subreddit caption lab</h1>
        <p className="text-sm text-gray-600">Generate tailored Reddit captions for multiple communities at once, save the variants, and post directly using your linked Reddit account.</p>
        {rateLimitInfo && <p className="text-xs text-gray-500">Tier <span className="font-medium">{rateLimitInfo.tier}</span> · {rateLimitInfo.remaining} generations remaining · resets {formatDate(rateLimitInfo.resetAt)}</p>}
      </section>
      <section className={cardClass}>
        <form className="flex flex-col gap-6" onSubmit={handleGenerate}>
          <div className="grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Image URL<input className={inputClass} placeholder="https://cdn.example.com/photo.jpg" value={imageUrl} onChange={event => setImageUrl(event.target.value)} type="url" required /></label>
            <label className={labelClass}>Image asset ID (optional)<input className={inputClass} placeholder="123" value={imageId} onChange={event => setImageId(event.target.value)} type="number" min={0} /></label>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">Tone</span>
            <button type="button" onClick={() => setNsfw(previous => !previous)} className={classNames('rounded-full px-4 py-1 text-sm font-medium shadow-sm transition', nsfw ? 'bg-rose-600 text-white hover:bg-rose-700' : 'bg-blue-600 text-white hover:bg-blue-700')}>{nsfw ? 'NSFW voice' : 'SFW voice'}</button>
            <span className="text-xs text-gray-500">Switching adjusts the default persona and generation safety guardrails.</span>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between"><h2 className={sectionTitleClass}>Subreddit targets</h2><button type="button" onClick={handleAddTarget} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700 transition hover:bg-blue-100">Add subreddit</button></div>
            <div className="flex flex-col gap-4">
              {targets.map(target => (
                <div key={target.id} className="rounded-md border border-dashed border-gray-300 p-4">
                  <div className="flex flex-col gap-4 md:flex-row md:items-end">
                    <label className="flex-1"><span className={labelClass}>Subreddit</span><input className={inputClass} placeholder="e.g. redditgetsdrawn" value={target.subreddit} onChange={event => handleSubredditChange(target.id, event.target.value)} required /></label>
                    <label className="flex-1"><span className={labelClass}>Persona</span><select className={inputClass} value={target.persona} onChange={event => handlePersonaChange(target.id, event.target.value as PersonaValue)}>{PERSONA_OPTIONS.map(option => (<option key={option.value} value={option.value}>{option.label}</option>))}</select></label>
                    <button type="button" onClick={() => handleRemoveTarget(target.id)} className="text-sm font-medium text-rose-600 transition hover:text-rose-700" disabled={targets.length === 1}>Remove</button>
                  </div>
                  <div className="mt-3 grid gap-2 md:grid-cols-3">
                    {TONE_TOGGLES.map(toggle => {
                      const active = target.tones.includes(toggle.id);
                      return (<button key={toggle.id} type="button" onClick={() => handleToneToggle(target.id, toggle.id)} className={classNames('flex flex-col items-start rounded-md border px-3 py-2 text-left text-xs transition', active ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:border-blue-200 hover:bg-blue-50')}><span className="font-medium">{toggle.label}</span><span className="mt-1 text-[11px] text-gray-500">{toggle.helper}</span></button>);
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
          {success && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}
          <div className="flex items-center gap-3"><button type="submit" className={classNames('inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2', loading && 'opacity-60')} disabled={loading}>{loading ? 'Generating…' : 'Generate captions'}</button>{loading && <span className="text-xs text-gray-500">Calling OpenRouter and saving your drafts…</span>}</div>
        </form>
      </section>
      <section className="flex flex-col gap-4">
        <h2 className={sectionTitleClass}>Caption variants</h2>
        {draftLoading && <p className="text-sm text-gray-500">Loading saved variants…</p>}
        {draftError && <p className="text-sm text-rose-600">{draftError}</p>}
        {!draftLoading && combinedVariants.length === 0 && <p className="text-sm text-gray-500">No caption variants yet. Generate a few to get started.</p>}
        <div className="grid gap-4 lg:grid-cols-2">
          {combinedVariants.map(variant => {
            const override = overrides[variant.id] ?? {};
            const isSelected = selectedVariants.has(variant.id);
            return (
              <article key={variant.id} className={classNames(cardClass, 'border-gray-200', isSelected && 'ring-2 ring-blue-500')}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">r/{variant.subreddit}</span>
                      {variant.persona && <span className={chipClass}>{variant.persona}</span>}
                      {variant.isNew && <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">New</span>}
                    </div>
                    <p className="text-xs text-gray-500">Saved {formatDate(variant.createdAt)}</p>
                  </div>
                  <button type="button" onClick={() => handleVariantSelection(variant.id)} className={classNames('rounded-full border px-3 py-1 text-xs font-medium transition', isSelected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600 hover:bg-blue-50')}>{isSelected ? 'Selected' : 'Select'}</button>
                </div>
                <p className="mt-3 text-sm text-gray-800">{variant.caption}</p>
                {variant.cta && <p className="mt-2 text-xs text-gray-500">CTA: {variant.cta}</p>}
                {variant.hashtags.length > 0 && <p className="mt-2 text-xs text-gray-500">Hashtags: {variant.hashtags.map(tag => `#${tag}`).join(' ')}</p>}
                <div className="mt-4 grid gap-3">
                  <label className={labelClass}>Schedule (optional)<input type="datetime-local" className={inputClass} value={override.scheduleAt ?? ''} onChange={event => handleOverrideChange(variant.id, 'scheduleAt', event.target.value)} /></label>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className={labelClass}>Flair ID<input className={inputClass} value={override.flairId ?? ''} onChange={event => handleOverrideChange(variant.id, 'flairId', event.target.value)} /></label>
                    <label className={labelClass}>Flair text<input className={inputClass} value={override.flairText ?? ''} onChange={event => handleOverrideChange(variant.id, 'flairText', event.target.value)} /></label>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-600"><input type="checkbox" checked={override.nsfw ?? variant.nsfw ?? nsfw} onChange={event => handleOverrideChange(variant.id, 'nsfw', event.target.checked)} />Mark post as NSFW</label>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      {combinedVariants.length > 0 && (
        <section className={cardClass}>
          <div className="flex flex-col gap-4">
            <h2 className={sectionTitleClass}>Post to selected subreddits</h2>
            {postError && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{postError}</p>}
            {postSuccess && <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{postSuccess}</p>}
            <div className="flex items-center gap-3">
              <label className={labelClass}>Throttle between posts (ms)<input className={inputClass} type="number" min={0} max={600000} value={throttleMs} onChange={event => setThrottleMs(Number(event.target.value))} /></label>
              <button type="button" onClick={handlePost} className={classNames('mt-5 inline-flex items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2', postLoading && 'opacity-60')} disabled={postLoading}>{postLoading ? 'Submitting…' : 'Post to selected subs'}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
