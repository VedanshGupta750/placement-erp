// Network card grids live inside the dashboard's narrow left column, so they
// size off their own container rather than the viewport. A viewport breakpoint
// cannot see that column's width, and `minmax(min(100%, 18rem), 1fr)` — what
// these grids used before — is resolved inconsistently once the grid is nested
// inside another grid track: browsers that treat the percentage as indefinite
// fall back to the card's min-content, packing three ~220px columns into a
// 680px column and pushing the member name underneath the overflow menu.
//
// The breakpoints are in rem on purpose. `globals.css` scales the root font
// from 16px to 20px with the viewport, and a container query resolves rem
// against that live root size, so a card keeps roughly the same number of
// characters per line at either end of that range instead of getting squeezed
// as the type grows. One card needs about 16.5rem before its header row
// (checkbox, avatar, name, overflow menu) starts to crowd.
export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-3 @min-[34rem]:grid-cols-2 @min-[51rem]:grid-cols-3 @min-[69rem]:grid-cols-4">
        {children}
      </div>
    </div>
  );
}
