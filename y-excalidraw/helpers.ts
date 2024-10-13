import { ExcalidrawElement } from "@excalidraw/excalidraw/types/element/types";
import * as Y from "yjs"


export const moveArrayItem = <T>(arr: T[], from: number, to: number, inPlace = true) => {
  if (!inPlace) {
    arr = [...arr]
  }
  arr.splice(to, 0, arr.splice(from, 1)[0]);
  return arr
};

export const areElementsSame = (els1: readonly {id: string, version: number}[], els2: readonly {id: string, version: number}[]) => {
  if (els1.length !== els2.length) {
    return false
  }

  for (let i=0; i<els1.length; i++) {
    const [el1, el2] = [els1[i], els2[i]]
    if (el1.id !== el2.id || el1.version !== el2.version ) {
      return false
    }
  }

  return true
}

export const yjsToExcalidraw = (yArray: Y.Array<Y.Map<any>>): ExcalidrawElement[] => {
  let x = yArray.toArray()
    .sort((a, b) => {
      const key1 = a.get("pos") as string;
      const key2 = b.get("pos") as string;
      return key1 > key2 ? 1 : (key1 < key2 ? -1 : 0)
    })
    .map((x) => (x.get("el") as ExcalidrawElement))
  return x
}