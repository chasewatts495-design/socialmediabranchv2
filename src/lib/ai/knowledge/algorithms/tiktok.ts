const content = `
# TikTok Algorithm Playbook

TikTok is the purest interest-graph platform: follower count barely matters, every video is
auditioned to a fresh test audience, and retention metrics decide everything downstream.

## Ranking signals

1. **Completion rate and rewatches.** The dominant pair. A video watched to 100 percent - and
   especially looped - is the strongest possible signal. Widely observed: videos with loop-friendly
   endings (the last frame flows into the first) materially outperform.
2. **The first 1 to 2 seconds.** Scroll-past happens almost instantly; hook rate (viewers still
   present at 3 seconds) is the gatekeeper metric TikTok surfaces in its own analytics. Below
   roughly 70 percent hook retention, distribution stalls regardless of content quality.
3. **Engagement velocity in the first 60 to 90 minutes.** Widely observed batch-testing: TikTok
   serves an initial audience of roughly 200 to 600 viewers; if watch time, likes-per-view, shares,
   and comments clear thresholds, it escalates to progressively larger batches. Each escalation
   re-tests, so videos can resurge days or weeks later.
4. **Shares and saves.** Weighted above likes; shares to external apps are widely observed to be
   the strongest single engagement action for For You expansion.
5. **Comments and comment dwell.** Time spent reading comments counts as watch time. Comment-bait
   built into content (mild controversy, deliberate small errors) is a known velocity tactic.
6. **Search and interest matching.** TikTok is now a major search engine; keywords spoken aloud,
   in on-screen text, and in captions feed both search and interest-graph classification.
7. **Creator consistency.** Widely observed: accounts posting regularly in one niche get faster,
   more accurate audience matching than generalists.

## Format meta (current)

- 9:16 vertical, 1080x1920, full-bleed. Sub-15-second videos maximise completion; 21 to 34 seconds
  is a widely cited sweet spot balancing watch time volume with completion.
- Longer videos (1 to 3-plus minutes) earn more total watch time and are favoured for monetisation
  programmes, but demand genuine story structure - front-load the payoff promise.
- Carousels (photo mode) punch above their weight for niche/education content; swipe-through
  behaves like retention.
- On-screen text in the first frame, spoken hook, and captions on by default. Native text, stickers,
  and TikTok effects are mildly favoured over imported graphics.

## Timing and cadence

- Widely observed windows: 6 to 9am, 12 to 2pm, 7 to 11pm audience-local; evenings dominate.
- Cadence: 1 to 3 posts per day is the standard growth prescription; minimum 4 to 5 per week to
  keep the interest-graph matching warm. Space posts 3-plus hours apart.
- Decay curve: most videos see 80 percent of views in 48 hours, but the batch system means dead
  videos can revive. Never delete underperformers; set them private only if off-brand.

## Penalties and traps

- **Watermarked or visibly recycled content** from other platforms is deprioritised.
- **Engagement bait** ("like and follow for part 2" with no substance) risks suppression; genuine
  part 2 open loops are fine and effective.
- **External links and driving off-platform** in captions correlate with reduced reach.
- **Unoriginal duets/stitches with no added value**, spam hashtags, and follow-for-follow loops
  read as low quality.
- **Community guideline grey zones** (implied violence, medical claims, profanity in first seconds)
  trigger reduced For You eligibility without notification - the classic shadow-limit.
- Deleting and reposting the same video repeatedly is widely observed to suppress the account.

## Levers ranked by impact

1. Rebuild the first 2 seconds: start mid-action, state the payoff, or show the end result first.
2. Cut every dead frame - target average shot length under 2 seconds for retention edits.
3. Engineer the loop: end mid-sentence or match final frame to first frame for rewatches.
4. Say and display your niche keywords for search indexing.
5. Reply to early comments within 30 minutes; pin the best comment-bait reply.
6. Post daily in one tight niche until the account's audience matching locks in.
7. Ride sounds and formats while they are rising, not after they peak.
`;
export default content;
