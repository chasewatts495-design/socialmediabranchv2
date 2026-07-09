const content = `
# X (Twitter) Algorithm Playbook

X's For You feed is a two-stage system (candidate sourcing, then heavy ML ranking) whose weights
were partially open-sourced in 2023. Roughly half of For You candidates come from accounts you do
not follow, which makes X unusually winnable for small accounts with strong reply games.

## Ranking signals

1. **Replies weighted heaviest.** The open-sourced code showed a reply is worth many times a like
   (widely cited at roughly 13.5x a like within that snapshot, retweets around 20x for extended
   engagement chains, with author-engaged replies scoring higher still). Conversation is the
   currency: posts that provoke replies - questions, hot takes, fill-in-the-blank - compound.
2. **Early engagement window.** Widely observed: the first 30 to 60 minutes decide whether a post
   is sourced into non-follower For You feeds. Low velocity means the post quietly dies.
3. **Author reputation and TweepCred.** Follower-to-following ratio, historical engagement rate,
   and account age feed a PageRank-style author score that gates distribution.
4. **Verified (Premium) boost.** X has stated Premium subscribers receive a ranking boost in
   replies and For You; reply visibility is where it is most noticeable.
5. **Dwell time and profile clicks.** Time spent expanded on a post, media viewed, and click-
   through to your profile are positive inputs; the "show less often" signal and mutes/blocks are
   strong negatives with long-lasting author-level effects.
6. **Media richness.** Native images, video, and polls outperform bare text on average; native
   video watch time is increasingly favoured as X pushes video.
7. **Out-of-network virality.** If your followers' followers engage, the graph expansion
   (SimClusters / communities) pushes the post into adjacent interest clusters.

## Format meta (current)

- **Single-post bangers:** one sharp claim, under 280 characters, no link. The core viral unit.
- **Threads:** still effective for depth; hook post must stand alone, 5 to 12 posts, one idea per
  post, end with a recap plus follow prompt. Widely observed: threads earn profile clicks.
- **Native video:** 16:9 or 1:1, under 2 minutes 20 for broad content; captions on.
- **Long-form posts (Premium):** good for essays; the first 280 characters still decide reach.
- **Polls:** cheap engagement velocity; use to seed a debate you then quote-post.

## Timing and cadence

- Widely observed windows: weekdays 8 to 10am and 12 to 1pm audience-local; news cycles override
  everything - speed to a breaking topic beats scheduled timing.
- Cadence: 2 to 5 original posts per day plus 10 to 30 replies. The reply game (thoughtful replies
  to large accounts in your niche within minutes of their posting) is the highest-ROI growth
  activity for accounts under 10k followers.
- Decay: median post life is 2 to 6 hours; almost all impressions inside 24 hours. Repost your own
  winners after 30-plus days; evergreen recycling is normal practice.

## Penalties and traps

- **External links are suppressed** in For You ranking - widely observed and repeatedly measured
  by practitioners. Post the value natively; put the link in a reply or your bio.
- **Hashtag stuffing:** more than 1 to 2 hashtags reads as spam; hashtags matter far less than
  keywords on modern X.
- **Engagement bait and reply-gating** ("comment X and I'll DM you") works short-term but attracts
  "show less often" feedback that degrades author reputation.
- **Blocks, mutes, unfollows, and reports** apply heavy negative weight - rage-bait burns the
  account even while individual posts spike.
- Posting the same text repeatedly, mass-following, and DM spam trigger visibility filtering.

## Levers ranked by impact

1. Cut every post to one idea and delete the link - move URLs to the reply.
2. Spend 30 minutes daily replying early and substantively to big accounts in your niche.
3. Engineer replies: end posts with a question, a ranking to dispute, or a missing item.
4. Reply to replies fast in the first hour; author engagement multiplies thread scoring.
5. Quote-post your own thread the next morning to catch the second timezone.
6. Convert winning posts into native video versions for the video-boosted surface.
`;
export default content;
