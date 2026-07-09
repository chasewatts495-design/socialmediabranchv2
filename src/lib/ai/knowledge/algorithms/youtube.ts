const content = `
# YouTube Algorithm Playbook

YouTube is a recommendation engine optimising predicted satisfaction and session time. Shorts and
long-form run on separate feeds with separate signals - treat them as two platforms. Long-form is
the only major social surface where content reliably compounds for years.

## Ranking signals

1. **CTR x average view duration, as a single unit.** The classic long-form equation: a click-
   through rate that survives contact with the content. High CTR with fast abandonment is punished;
   modest CTR with deep watch time still wins. Thumbnail and title are therefore inseparable from
   the video - they are the packaging half of the same product.
2. **Average view duration and percentage.** Widely cited benchmarks: 50 percent-plus retention on
   an 8 to 12 minute video is strong; the first 30 seconds sees the steepest drop and must confirm
   the thumbnail's promise immediately.
3. **Satisfaction surveys and post-watch behaviour.** YouTube explicitly uses survey responses,
   likes/dislikes, "not interested" clicks, and whether viewers return to the channel. Session
   continuation (viewer keeps watching YouTube after your video) helps you.
4. **Impressions ecosystem fit.** The algorithm tests videos against audiences who watched similar
   content; consistent niche and consistent packaging style speed up correct matching.
5. **Shorts: swipe-away versus watched-in-full.** Shorts ranking is TikTok-like - viewed versus
   swiped ratio, loops, and engagement velocity. Shorts feed subscribers poorly but sample
   enormous cold audiences.
6. **Browse and suggested placement.** Mature channels get most views from Browse (homepage) and
   Suggested (next to related videos); end screens and series playlists directly farm Suggested.
7. **Upload consistency matters less than packaging.** YouTube has stated inactivity is not
   directly punished - each video is judged on its own predicted performance.

## Format meta (current)

- **Long-form:** 16:9; 8 to 15 minutes is the mainstream sweet spot; 20-plus minutes wins where
  retention holds (documentary, video essay). Chapters and pattern-interrupt editing every 20 to
  40 seconds counter mid-roll decay.
- **Thumbnails:** under 3 elements, one readable emotion or object, 3 to 5 word text max, high
  contrast; faces with expressive emotion widely outperform. Test alternates with the built-in
  Test and Compare tool.
- **Shorts:** 9:16, up to 3 minutes now but under 35 seconds still dominates; loop-friendly ends.
- **Titles:** front-load the keyword and the tension; under roughly 55 characters to avoid
  truncation.

## Timing and cadence

- Publish 2 to 4 hours before your audience's peak (widely observed: weekday afternoons and
  weekend mornings) so early velocity data lands at peak browse time. Timing matters less than on
  any other platform.
- Cadence: 1 strong long-form per week beats 3 mediocre; Shorts 3 to 7 per week as a sampling
  layer. Long-form videos routinely gain views for months or years - the decay curve has a heavy
  compounding tail via search and Suggested.

## Penalties and traps

- **Misleading packaging:** thumbnail/title bait that tanks retention teaches the algorithm to
  stop recommending you; the CTR-retention unit self-corrects against clickbait.
- **Sub4Sub, purchased views, and engagement pods** distort satisfaction predictions and can
  trigger removal.
- **Reused/unoriginal content** breaks monetisation policy and suppresses recommendation.
- **Burying the payoff:** long cold intros are the single most common retention killer; the first
  30 seconds must re-sell the click.
- **Ignoring "not interested" drift:** chasing trends outside your niche pollutes your audience
  model and depresses future impressions.

## Levers ranked by impact

1. Decide thumbnail plus title BEFORE production; if the packaging is not clickable, do not make
   the video.
2. Rewrite the first 30 seconds: confirm the promise, preview the payoff, cut all throat-clearing.
3. Study your retention graph per video; find the timestamp of each cliff and fix that pattern.
4. Build series and playlists so Suggested feeds your own catalogue.
5. Run thumbnail A/B tests on every upload; a 1-point CTR gain compounds across the back catalogue.
6. Use Shorts to test hooks and topics cheaply, then produce long-form winners.
`;
export default content;
