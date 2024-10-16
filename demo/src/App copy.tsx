import * as React from "react";

import { Excalidraw } from "@excalidraw/excalidraw";
import * as Y from "yjs";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types/types";
import { ExcalidrawBinding, yjsToExcalidraw } from "../../src"

import { WebrtcProvider } from 'y-webrtc'

import * as random from 'lib0/random'
import { SIGNALLING_SERVER } from "./constants";

import equal from "fast-deep-equal/es6"

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
const yElements = ydoc.getArray<Y.Map<any>>('elements');
const yAssets = ydoc.getMap('assets');
const undoManager =  new Y.UndoManager(yElements, {captureTimeout: 0, trackedOrigins: new Set(["test"])});

const provider = new WebrtcProvider('y-excalidraw-demo-room', ydoc, { signaling: [SIGNALLING_SERVER] })

provider.awareness.setLocalStateField('user', {
  name: 'Anonymous ' + Math.floor(Math.random() * 100),
  color: userColor.color,
  colorLight: userColor.light
})

const clone = (data) => JSON.parse(JSON.stringify(data))

let lastKnown = []
export default function App() {
  const [api, setApi] = React.useState<ExcalidrawImperativeAPI | null>(null);
  const [binding, setBindings] = React.useState<ExcalidrawBinding | null>(null);
  const excalidrawRef = React.useRef(null);

  const [plainElements, setPlainElements] = React.useState<any>([])

  ydoc.on("update", () => {
    const latest = yElements.toJSON();
    if (equal(lastKnown, latest)) {
      return
    }
    lastKnown = latest
    setPlainElements(latest)
    console.log('elements', latest)
  });
  
  const initialize = () => {
    console.log("initialize")
    binding.initialize()
  }

  const doAction = () => {
    console.log("doAction")
    binding.doAction()
  }

  const undo = () => {
    console.log("undo")
    undoManager.undo()
  } 

  const redo = () => {
    console.log("redo")
    undoManager.redo()
  }

  React.useEffect(() => {
    if (!api) return;

    if (binding) {
      binding.destroy()
    }
    const x = new ExcalidrawBinding(
      yElements,
      yAssets,
      excalidrawRef.current,  // excalidraw dom is needed to override the undo/redo buttons in the UI as there is no way to pass it via props in excalidraw
      api,
      provider.awareness,
      undoManager
    );
    setBindings(x);
  }, [api])
  
  
  const initData = {
    elements: yjsToExcalidraw(yElements)
  }
  return (
    <div style={{width: "100vw", height: "100vh"}}>
      <div style={{ height: "300px", overflowY: "auto"}}>
        <div>
        <button onClick={initialize}>
          Initialize
        </button>
        <button onClick={doAction}>
          Do action
        </button>
        <button onClick={undo}>
          Undo
        </button>
        <button onClick={redo}>
          Redo
        </button>
        </div>
        <div style={{background: "green", overflow: "auto"}}>
        <pre>{JSON.stringify(plainElements, null, 2)}</pre>
      </div>
      </div>
      
      <div style={{width: "100vw", height: "calc(100vh - 300px)"}} ref={excalidrawRef}>
        <Excalidraw
          initialData={initData}
          excalidrawAPI={setApi}
          onPointerUpdate={(payload) => binding && binding.onPointerUpdate(payload)}
          theme="light"
        />
      </div>
    </div>
    
  );
}

