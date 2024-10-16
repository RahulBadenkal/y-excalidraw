import type {
  BinaryFileData,
  Collaborator,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import type * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs"
import { areElementsSame, yjsToExcalidraw } from "./helpers";
import { applyAssetOperations, applyElementOperations, getDeltaOperationsForAssets, getDeltaOperationsForElements, LastKnownOrderedElement, Operation } from "./diff";
export { yjsToExcalidraw }

export class ExcalidrawBinding {
  yElements: Y.Array<Y.Map<any>>
  yAssets: Y.Map<any>
  dom: HTMLElement
  api: ExcalidrawImperativeAPI;
  undoManager: Y.UndoManager
  awareness?: awarenessProtocol.Awareness;

  subscriptions: (() => void)[] = [];
  collaborators: Map<string, Collaborator> = new Map();
  lastKnownElements: LastKnownOrderedElement[] = []
  lastKnownFileIds: Set<string> = new Set();

  constructor(yElements: Y.Array<Y.Map<any>>, yAssets: Y.Map<any>, excalidrawDom: HTMLElement, api: ExcalidrawImperativeAPI, awareness?: awarenessProtocol.Awareness, undoManager?: Y.UndoManager) {
    this.yElements = yElements;
    this.yAssets = yAssets;
    this.api = api;
    this.awareness = awareness;
    this.undoManager = undoManager
    this.subscriptions.push(() => this.undoManager.destroy())

    // Listener for changes made on excalidraw by current user
    this.subscriptions.push(
      this.api.onChange((_, state, files) => {
        // TODO: Excalidraw doesn't delete the asset from the map when the associated item is deleted.
        const elements = this.api.getSceneElements()  // This returns without deleted elements

        // This fires very often even when data is not changed, so keeping a fast procedure to check if anything changed or not
        // Even on move operations, the version property changes so this should work
        let operations: Operation[] = []
        if (!areElementsSame(this.lastKnownElements, elements)) {
          const res = getDeltaOperationsForElements(this.lastKnownElements, elements)
          operations = res.operations
          this.lastKnownElements = res.lastKnownElements
          applyElementOperations(this.yElements, operations, this)
        }

        const res = getDeltaOperationsForAssets(this.lastKnownFileIds, files)
        const assetOperations = res.operations
        this.lastKnownFileIds = res.lastKnownFileIds
        if (assetOperations.length > 0) {
          applyAssetOperations(this.yAssets, assetOperations, this)
        }

        if (this.awareness) {
          // update selected awareness
          this.awareness.setLocalStateField(
            "selectedElementIds",
            state.selectedElementIds,
          );
        }
      }),
    );

    // Listener for changes made on yElements by remote users
    const _remoteElementsChangeHandler = (event: Array<Y.YEvent<any>>, txn: Y.Transaction) => {
      if (txn.origin === this) {
        return
      }

      // elements changed outside this component, reflect the change in excalidraw ui
      const elements = yjsToExcalidraw(this.yElements)
      this.lastKnownElements = this.yElements.toArray().map((x) => ({ id: x.get("el").id, version: x.get("el").version, pos: x.get("pos") }))
      this.api.updateScene({ elements })
    }
    this.yElements.observeDeep(_remoteElementsChangeHandler)
    this.subscriptions.push(() => this.yElements.unobserveDeep(_remoteElementsChangeHandler))

    // Listener for changes made on yAssets by remote users
    const _remoteFilesChangeHandler = (events: Y.YMapEvent<any>, txn: Y.Transaction) => {
      if (txn.origin === this) {
        return
      }

      const addedFiles = [...events.keysChanged].map(
        (key) => this.yAssets.get(key) as BinaryFileData,
      );
      this.api.addFiles(addedFiles);
    }
    this.yAssets.observe(_remoteFilesChangeHandler);  // only observe and not observe deep as assets are only added/deleted not updated
    this.subscriptions.push(() => {
      this.yAssets.unobserve(_remoteFilesChangeHandler);
    });

    if (this.awareness) {
      // Listener for awareness changes made by remote users
      const _remoteAwarenessChangeHandler = ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const states = this.awareness.getStates();

        const collaborators = new Map(this.collaborators);
        const update = [...added, ...updated];
        for (const id of update) {
          const state = states.get(id);
          if (!state) {
            continue;
          }

          collaborators.set(id.toString(), {
            pointer: state.pointer,
            button: state.button,
            selectedElementIds: state.selectedElementIds,
            username: state.user?.name,
            color: state.user?.color,
            avatarUrl: state.user?.avatarUrl,
            userState: state.user?.state,
          });
        }
        for (const id of removed) {
          collaborators.delete(id.toString());
        }
        collaborators.delete(this.awareness.clientID.toString());
        this.api.updateScene({ collaborators });
        this.collaborators = collaborators;
      };
      this.awareness.on("change", _remoteAwarenessChangeHandler);
      this.subscriptions.push(() => {
        this.awareness.off("change", _remoteAwarenessChangeHandler);
      });
    }

    if (this.undoManager) {
      this.setupUndoRedo(excalidrawDom)
    }

    // init code
    const initialValue = yjsToExcalidraw(this.yElements)
    this.lastKnownElements = this.yElements.toArray().map((x) => ({ id: x.get("el").id, version: x.get("el").version, pos: x.get("pos") }))
    this.api.updateScene({ elements: initialValue });
    this.api.addFiles(
      [...this.yAssets.keys()].map((key) => this.yAssets.get(key) as BinaryFileData),
    );
  }

  public onPointerUpdate = (payload: {
    pointer: {
      x: number;
      y: number;
      tool: "pointer" | "laser";
    };
    button: "down" | "up";
  }) => {
    if (this.awareness) {
      this.awareness.setLocalStateField("pointer", payload.pointer);
      this.awareness.setLocalStateField("button", payload.button);
    }
  };

  private setupUndoRedo(excalidrawDom: HTMLElement) {
    this.undoManager.addTrackedOrigin(this)
    this.subscriptions.push(() => this.undoManager.removeTrackedOrigin(this))

    // listen for undo/redo keys
    const _keyPressHandler = (event) => {
      if (event.ctrlKey && event.shiftKey && event.key?.toLocaleLowerCase() === 'z') {
        event.stopPropagation();
        this.undoManager.redo()
      }
      else if (event.ctrlKey && event.key?.toLocaleLowerCase() === 'z') {
        event.stopPropagation();
        this.undoManager.undo()
      }
    }
    excalidrawDom.addEventListener('keydown', _keyPressHandler, { capture: true });
    this.subscriptions.push(() => excalidrawDom?.removeEventListener('keydown', _keyPressHandler, { capture: true }))

    // hijack the undo/redo buttons on the canvas
    const _undoBtnHandler = (event) => {
      event.stopImmediatePropagation();
      this.undoManager.undo()
    }
    const undoButton = excalidrawDom.querySelector('[aria-label="Undo"]');
    undoButton.addEventListener('click', _undoBtnHandler);
    this.subscriptions.push(() => undoButton?.removeEventListener('click', _undoBtnHandler))

    const _redoBtnHandler = (event) => {
      event.stopImmediatePropagation();
      this.undoManager.redo()
    }
    const redoButton = excalidrawDom.querySelector('[aria-label="Redo"]');
    redoButton.addEventListener('click', _redoBtnHandler);
    this.subscriptions.push(() => redoButton?.removeEventListener('click', _redoBtnHandler))
  }

  initialize() {
    const init = [
      {pos: "a1", el: {"type":"rectangle","version":22,"versionNonce":1891494587,"index":"b0e","isDeleted":false,"id":"40nIV9Ei2YbJTIjdXr7IK","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":431.5109515570748,"y":-256.98887127143007,"strokeColor":"#1e1e1e","backgroundColor":"#ffc9c9","width":176,"height":195.99998474121094,"seed":458711771,"groupIds":[],"frameId":null,"roundness":{"type":3},"boundElements":[],"updated":1729037250974,"link":null,"locked":false}},
      {pos: "b1", el: {"type":"rectangle","version":46,"versionNonce":1345018837,"index":"b0f","isDeleted":false,"id":"ziHLKND6sKP-rBgN0yroE","fillStyle":"solid","strokeWidth":2,"strokeStyle":"solid","roughness":1,"opacity":100,"angle":0,"x":553.9109759711373,"y":-140.98887127143007,"strokeColor":"#1e1e1e","backgroundColor":"#b2f2bb","width":168,"height":160.79991149902344,"seed":1325009781,"groupIds":[],"frameId":null,"roundness":{"type":3},"boundElements":[],"updated":1729037252531,"link":null,"locked":false}}
    ]
    this.yElements.doc.transact(() => {
      for (let i=0; i<init.length; i++) {
        const item = init[i]
        const x = new Y.Map()
        x.set("pos", item.pos)
        x.set("el", item.el)
        this.yElements.push([x])
      }
    }, "test")
  }

  doAction() {
    this.yElements.doc.transact(() => {
      const item = this.yElements.get(1)
      item.set("pos", "Zz")
      const el = item.get("el")
      item.set("el", {...el, version: el.version + 1})
    }, "test")
  }

  undo() {
    this.undoManager.undo()
  }

  redo() {
    this.undoManager.redo()
  }

  destroy() {
    for (const s of this.subscriptions) {
      s();
    }
  }
}