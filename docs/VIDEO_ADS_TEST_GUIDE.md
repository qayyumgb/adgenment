# Video ads: test guide (C20a + C20b)

Branch `feature/video-ads`. Local only until the first paying client. Tick each box as you go; for anything wrong, note **which step, what you expected, what happened**, plus a screenshot and any red error from the browser console.

## Before you start

1. On `feature/video-ads`, with the API stopped: `cd apps/api && npx prisma generate`.
2. Start the API and the web app.
3. Have ready: a short MP4 (10–30 s), a phone video (`.mov` from an iPhone if you have one), and a brand kit with a logo (Creatives › Design an ad › Brand).
4. Optional: a connected Meta ad account (sections 7–8 upload to it).

Riskiest parts, where problems are most likely: **footage playback in the preview** (section 5) and **trimming with several clips** (section 6).

---

## 1. Starting a design

- [ ] Creatives › **Design an ad** › a size. The template screen opens.
- [ ] Top right of the template screen: **Make: Image ad / Video ad**.
- [ ] Choose **Video ad**: every card shows an **Animated** mark; pointing at a card plays its entrance.
- [ ] Switch back to **Image ad**: marks gone, cards still.
- [ ] Pick a template with **Video ad** on: it lands with animation, the timeline is open under the canvas and it plays once.
- [ ] Close the template screen without picking: the editor is empty and still works.

## 2. Timeline and animation

- [ ] **Video** button (top bar) opens and closes the timeline.
- [ ] **Play** (or Space) plays; Space again pauses.
- [ ] Drag along the ruler: the design follows; the pink line moves.
- [ ] Click the canvas during a preview: everything snaps back to where it was and is editable.
- [ ] **Animate for me**: every layer gets an animation and it plays. Ctrl+Z undoes it in one step.
- [ ] Select a layer › right sidebar **Animation**: change *Comes in*; only that part plays.
- [ ] Change *Starts at*, *Takes*, *While on screen*, *Leaves*, *Gone by*: the bar on the timeline follows.
- [ ] Drag the handles on a layer's bar: start and end times change.
- [ ] **Appear (cut)** and **Disappear (cut)**: the layer pops in / out with no transition.
- [ ] Text with **Typewriter**: letters appear one by one, the text never jumps.
- [ ] **Length** picker: 5 to 60 s; the ruler re-scales; times past the new end move inside it.
- [ ] **Remove all**: every animation goes; Ctrl+Z brings them back.
- [ ] Reload the page: the timeline reopens with the same length and animations.

## 3. Templates and resize

- [ ] Apply a different template on a video design: it replaces the canvas, animated, one undo step.
- [ ] **Resize** a video design to the other sizes: the copies open as videos with the same length and animation.
- [ ] A template made **before** you switched to video: **Animate for me** uses that template's own animation.

## 4. Make video

- [ ] **Make video**: progress shows on the timeline ("Making your video… N%"), then the video opens.
- [ ] The video matches the preview: fonts, positions, colours, timing, typewriter.
- [ ] **Download MP4**: the file plays in your video player.
- [ ] Change something: the button reads **Update video**, "Watch video (older)" plays the old one.
- [ ] Reload while a video is being made: the progress picks up again.
- [ ] Empty design: Make video says to add something first.

## 5. Footage (a video clip in the design)

- [ ] Left panel **Images and video › Upload video**, an MP4: "Uploading video…", then "Preparing video", then it appears full-size behind everything, and the length matches the clip (up to 60 s).
- [ ] Same with an iPhone `.mov`: plays in Chrome after preparing.
- [ ] A file over 100 MB: refused before uploading, with a clear message.
- [ ] Drop a video file onto a **photo frame** of a template: it fills that frame.
- [ ] Double-click the frame: drag to move the footage inside; **Zoom** works.
- [ ] Right sidebar **Video clip**: *Starts at* / *Ends at* change the picture on the canvas.
- [ ] **Sound** slider and **Mute** work in the preview.
- [ ] **Play**: the footage plays with sound, in time with the text animations.
- [ ] Drag the ruler: the footage scrubs.
- [ ] A clip shorter than the video: its last frame holds to the end.
- [ ] "Make the video N s long": the length matches the clip.
- [ ] **Make video**: the MP4 has the footage and its sound at the chosen volume.
- [ ] After an upload, **Your videos** (left panel) lists the clip with its length; clicking it adds it again (into the selected frame, or after the last clip).
- [ ] **Video from Creatives** (left panel): the picker lists your video creatives with their posters; picking one shows "Preparing video", then it's added.
  - [ ] a video saved from the editor (section 7)
  - [ ] a video uploaded in Creatives (Meta video): comes in, or says clearly that Meta doesn't share the file
- [ ] With a frame selected, its toolbar's **Video from Creatives** puts the video into that frame.

## 6. Clips in a row, end card

- [ ] **Add another video clip** (left panel) or **+ Add a clip after this one** (Video clip section): the second clip fades in as the first ends; the video gets longer.
- [ ] Second clip › *Comes in* › **Appear (cut)**: a hard cut.
- [ ] Shorten the first clip: the second clip and the video's end move earlier with it. Lengthen: they move later.
- [ ] On the timeline, each clip's blue bar starts where that clip starts.
- [ ] **Add a brand end card** (left panel, timeline open): the last 2.5 s on the brand colour with the logo and a line of text; edit the text on the canvas.
- [ ] Without a logo in the brand kit: the end card still works (text only).
- [ ] **Make video** with two clips and an end card: joins look right; **no click** in the sound at the cut.
- [ ] Undo / redo through all of the above.
- [ ] **Editing moment:** with two clips and an end card, the canvas shows the opening (first clip), not the end card; the timeline says "Editing at … s" with a dashed line.
- [ ] Select the second clip or the end card in Layers: the canvas moves to when it's on screen.
- [ ] Scrub to a moment, click beside the canvas: you edit at that moment.

## 7. Save to Creatives

> With a Meta ad account connected, this uploads the MP4 to that account's media library.

- [ ] Animated design › **Save to Creatives**: if the video is out of date it is made first (the button stays busy), then a toast says it was saved (and uploaded to Meta, if connected).
- [ ] Same from the video dialog's **Save to Creatives** button.
- [ ] Creatives: the card shows the poster; the drawer plays the video.
- [ ] Remove all animation and footage › Save to Creatives: it goes back to an **image** Creative.

## 8. Publish to Meta (needs a setup that can create ads)

- [ ] New campaign › pick the saved video › publish: the ad is created with the video and a poster.
- [ ] Two ad accounts: publish the same video to the second one (it is uploaded there on publish).

## 9. Not expected to work yet

- Auto captions, music library, AI script / voice, AI clips (later steps of the plan).
- Phones: the editor is desktop only.

---

## Results

**First pass by Claude, 2026-11-17, in Chrome on the local dev servers** (trial workspace, no Meta account). The owner's own pass is still needed: especially sound in the preview (Claude can't hear it), dragging handles, a real phone video, Resize, and Meta.

| Section | Date | Result | Notes |
| --- | --- | --- | --- |
| 1 Starting a design | 17 Nov | Pass | Image / Video switch; Animated marks; hover plays the entrance; template lands animated and plays. |
| 2 Timeline | 17 Nov | Pass (partly) | Play, scrub (frame at 0.4 s correct), click-to-edit restores the design, Animation panel shows the layer's settings, reload keeps everything. Not tried: dragging handles, every animation type, Remove all. |
| 3 Templates, resize | | | Not tried. |
| 4 Make video | 17 Nov | Pass, 1 fix | Render matches the preview; "Update video" after a change. **Fixed:** the render waited up to 10 s in the queue ("Starting…"); now under 1 s. |
| 5 Footage | 17 Nov | Pass (partly) | MP4 upload, Video clip panel, scrubbing moves the footage, MP4 has the footage and a sound track, Your videos lists it. Not tried: iPhone .mov, drop on a frame, Video from Creatives, hearing the sound. |
| 6 Clips, end card | 17 Nov | Pass, 1 fix | Second clip fades in as the first ends; trimming moves it and the end; end card without a logo; crossfade frame and no click at the join (checked in the MP4). **Fixed:** undo / redo didn't restore the video's length. |
| 7 Save to Creatives | 17 Nov | Pass, 1 fix | Saved as a Video creative with its poster; the drawer plays it. **Fixed:** the canvas went blank after saving (also on main for image ads; see IMPLEMENTATION.md). |
| 8 Publish to Meta | | | Not tried (no Meta account in this workspace). |

**Usability issue found and fixed the same day:** while editing, a layer that only comes in later covered the ones below it (the second clip hid the first; an end card hid the whole ad). The canvas now shows the editing moment (section 6, last three items).
