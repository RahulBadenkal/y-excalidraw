import { getSceneVersion } from "@excalidraw/excalidraw";
import type {
  BinaryFileData,
  Collaborator,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types/types";
import type * as awarenessProtocol from "y-protocols/awareness";
import * as Y from "yjs"
import { yjsToExcalidraw } from "./helpers";
import { applyOperations, getDeltaOperationsForYjs, LastKnownOrderedElement } from "./diff";

export class ExcalidrawBinding {
  yArray: Y.Array<Y.Map<any>>
  api: ExcalidrawImperativeAPI
  
  subscriptions: (() => void)[] = [];
  collaborators: Map<string, Collaborator> = new Map();
  lastKnownSceneVersion: number = -1;
  lastKnownElements: LastKnownOrderedElement[] = []

  constructor(yArray: Y.Array<Y.Map<any>>, api: ExcalidrawImperativeAPI, private awareness?: awarenessProtocol.Awareness) {
    this.yArray = yArray
    this.api = api
    
    // Listener for changes made on excalidraw by current user
    this.subscriptions.push(
      api.onChange(() => {
        const elements = api.getSceneElements()  // This returns without deleted elements
        const sceneVersion = getSceneVersion(elements)

        if (sceneVersion <= this.lastKnownSceneVersion) {
          // This fires very often even when data is not changedk, so keeping a fast procedure to check if anything changed or not
          // The logic is taken from excliadraw repo
          // Even on move operations, the version property changes so this should work
          return
        }

        const {operations, lastKnownElements} = getDeltaOperationsForYjs(this.lastKnownElements, elements)
        applyOperations(this.yArray, operations)

        this.lastKnownElements = lastKnownElements
        this.lastKnownSceneVersion = sceneVersion
      }),
    );

    // Listener for changes made on yArray by remote users
    const observer = (event: any, transaction: any) => {
      if (transaction.origin === this) {
        return
      }
  
      // console.log('remote changes')
      // elements changed outside this component, reflect the change in excalidraw ui
      const elements = yjsToExcalidraw(this.yArray)
      this.lastKnownSceneVersion = getSceneVersion(elements)
      this.lastKnownElements = this.yArray.toArray().map((x) => ({id: x.get("el").id, version: x.get("el").version, pos: x.get("pos")}))
      this.api.updateScene({elements})
    }
    this.yArray.observeDeep(observer)
    this.subscriptions.push(() => this.yArray.unobserveDeep(observer))

    if (this.awareness) {
      // Listener for changes made to selected elements by current user
      this.subscriptions.push(
        api.onChange((_, state) => {
          this.awareness!.setLocalStateField(
            "selectedElementIds",
            state.selectedElementIds,
          );
        })
      )
      
      // Listener for awareness changes made by remote users
      const awarenessChangeHandler = ({
        added,
        updated,
        removed,
      }: {
        added: number[];
        updated: number[];
        removed: number[];
      }) => {
        const states = this.awareness!.getStates();

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
        collaborators.delete(this.awareness!.clientID.toString());
        api.updateScene({collaborators});
        this.collaborators = collaborators;
      };
      this.awareness.on("change", awarenessChangeHandler);
      this.subscriptions.push(() => {
        this.awareness!.off("change", awarenessChangeHandler);
      });
    }

    // init code
    const initialValue = yjsToExcalidraw(this.yArray)
    this.lastKnownSceneVersion = getSceneVersion(initialValue)
    this.lastKnownElements = this.yArray.toArray().map((x) => ({id: x.get("el").id, version: x.get("el").version, pos: x.get("pos")}))
    this.api.updateScene({elements: initialValue});
  }

  public onPointerUpdate = (payload: {
    pointer: {
      x: number;
      y: number;
      tool: "pointer" | "laser";
    };
    button: "down" | "up";
  }) => {
    this.awareness?.setLocalStateField("pointer", payload.pointer);
    this.awareness?.setLocalStateField("button", payload.button);
  };

  destroy() {
    for (const s of this.subscriptions) {
      s();
    }
  }
}

export class ExcalidrawAssetsBinding {
  subscriptions: (() => void)[] = [];

  constructor(yMap: Y.Map<any>, api: ExcalidrawImperativeAPI) {
    this.subscriptions.push(
      api.onChange((_element, _appstate, files) => {
        const doc = yMap.doc;
        doc?.transact(() => {
          for (const key in files) {
            // Asset once added is never updated
            // TODO: If an asset is deleted, excalidraw doesn't delete it from the files map. Clean that up somehow as size will increase
            if (!yMap.get(key)) {
              yMap.set(key, files[key]);
            }
          }
        }, this);
      }),
    );

    const handler = (events: Y.YMapEvent<any>, txn: Y.Transaction) => {
      if (txn.origin === this) {
        return;
      }

      const addedFiles = [...events.keysChanged].map(
        (key) => yMap.get(key) as BinaryFileData,
      );
      api.addFiles(addedFiles);
    };
    yMap.observe(handler);
    this.subscriptions.push(() => {
      yMap.unobserve(handler);
    });

    // set initial
    api.addFiles(
      [...yMap.keys()].map((key) => yMap.get(key) as BinaryFileData),
    );
  }
  
  destroy() {
    for (const s of this.subscriptions) {
      s();
    }
  }
}