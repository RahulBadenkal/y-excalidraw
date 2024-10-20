# y-excalidraw

> Excalidraw whiteboard binding for Yjs - [Demo](https://y-excalidraw.rahulbadenkal.com/)

This binding binds a Y.Array to a Excalidraw whiteboard.

```
npm install y-excalidraw
```

## Features
- Sync Excalidraw whiteboard elements
- Awareness: Sync remote cursor and selections
- Assets/Files syncing
- Shared Undo / Redo (each client has its own undo-/redo-history) - as a separate plugin

## Todo
- Add tests
- Check the feasibility of making every element key collaborative
- Add benchmarks

## Note
The sync is at the excalidraw array item (element) level but not at the element key level. Even the excalidraw cloud offering doesn't support that ([Link](https://blog.excalidraw.com/building-excalidraw-p2p-collaboration-feature/)). It would not be very hard to add it here but there are 2 issues that might crop up
- If operation 1 on client 1 changes 2 keys (keyA: ValueA, keyB: ValueB) on an array element. Then say operation 2 on client 2 changes 1 key (keyA: ValueZ) on the same array element. If the sync was at the key level then the final array item will be - (keyA: ValueZ, keyB: ValueB) and I am not sure if this final state is always valid. Are all keys of an excalidraw array element independent of each other? 
- Since on any change on the canvas, excalidraw onChange callback fires with the complete new state of the canvas but no diffs. So to make the app reactive at key level we would need to do a deep diff to figure out what key excatly changed. I am not sure how much extra runtime overhead this will introduce, will need to benchmark

## Helpful resources
- Excalidraw team's blog on how they achieved p2p sharing with excalidraw -> [Link](https://blog.excalidraw.com/building-excalidraw-p2p-collaboration-feature/)
- How to move items in an array in a safe manner, yjs discussion -> [Link](https://discuss.yjs.dev/t/moving-elements-in-lists/92/15?u=rahulbadenkal)
- Another intgeration of yjs with excalidraw. Most of the setup code is inspired from there -> [Link](https://github.com/satoren/y-phoenix-channel)
- Code for the demo was taken from yjs-codemirror.next repo -> [Link](https://github.com/yjs/y-codemirror.next)

## Getting Started
Install y-excalidraw (Make sure excalidraw and yjs are already installed)
```
npm install y-excalidraw
```

## Example
```typescript
import * as React from "react";

import { Excalidraw } from "@excalidraw/excalidraw";
import * as Y from "yjs";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawBinding } from "y-excalidraw"

import { WebrtcProvider } from 'y-webrtc'

import * as random from 'lib0/random'

export const usercolors = [
  { color: '#30bced', light: '#30bced33' },
  { color: '#6eeb83', light: '#6eeb8333' },
  { color: '#ffbc42', light: '#ffbc4233' },
  { color: '#ecd444', light: '#ecd44433' },
  { color: '#ee6352', light: '#ee635233' },
  { color: '#9ac2c9', light: '#9ac2c933' },
  { color: '#8acb88', light: '#8acb8833' },
  { color: '#1be7ff', light: '#1be7ff33' }
]

export const userColor = usercolors[random.uint32() % usercolors.length]

const ydoc = new Y.Doc()
const yElements = ydoc.getArray<Y.Map<any>>('elements');  // structure = {el: NonDeletedExcalidrawElement, pos: string}
const yAssets = ydoc.getMap('assets');

const provider = new WebrtcProvider('y-excalidraw-demo-room', ydoc)

provider.awareness.setLocalStateField('user', {
  name: 'Anonymous ' + Math.floor(Math.random() * 100),
  color: userColor.color,
  colorLight: userColor.light
})

export default function App() {
  const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null);
  const [binding, setBindings] = React.useState<ExcalidrawBinding | null>(null);
  const excalidrawRef = React.useRef(null);

  React.useEffect(() => {
    if (!api) return;

    const binding = new ExcalidrawBinding(
      yElements,
      yAssets,
      api,
      provider.awareness,
      // excalidraw dom is needed to override the undo/redo buttons in the UI as there is no way to override it via props in excalidraw
      // You might need to pass {trackedOrigins: new Set()} to undomanager depending on whether your provider sets an origin or not
      {excalidrawDom: excalidrawRef.current, undoManager: new Y.UndoManager(yElements)},
   );
    setBindings(binding);
    return () => {
      setBindings(null);
      binding.destroy();
    };
  }, [api]);

  const initData = {
    elements: yjsToExcalidraw(yElements)
  }

  return (
    <div style={{width: "100vw", height: "100vh"}} ref={excalidrawRef}>
      <Excalidraw
        initialData={initData}  // Need to set the initial data
        excalidrawAPI={setApi}
        onPointerUpdate={binding?.onPointerUpdate}
        theme="light"
      />
    </div>
  );
}
```

If you want to get the excalidraw array, you can use the utility function
```typescript
import { yjsToExcalidraw } from "y-excalidraw"

console.log("Excalidraw json", yjsToExcalidraw(yElements))
```