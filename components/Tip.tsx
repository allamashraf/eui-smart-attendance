// A small (i) that shows extra detail on hover or keyboard focus. Pure CSS; the text is also the
// accessible name, so screen readers get it without hovering.
export function Tip({text}:{text:string}){
  return <button type="button" className="tip" data-tip={text} aria-label={text}>i</button>;
}
