import { ExcalidrawElement, NonDeletedExcalidrawElement } from "@excalidraw/excalidraw/types/element/types"
import { moveArrayItem } from "./helpers"
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import * as Y from 'yjs'


export type UpdateOperation = { type: 'update', id: string, index: number, element: ExcalidrawElement }
export type AppendOperation = { type: 'append', id: string, pos: string, element: ExcalidrawElement }
export type DeleteOperation = { type: 'delete', id: string, index: number }
export type MoveOperation = { type: 'move', id: string, fromIndex: number, toIndex: number, pos: string; }
export type BulkAppendOperation = { type: 'bulkAppend', data: { id: string, pos: string; element: ExcalidrawElement }[] }
export type BulkDeleteOperation = { type: 'bulkDelete', id: string, index: number, data: { id: string, index: number }[] }

export type Operation = UpdateOperation | AppendOperation | DeleteOperation | MoveOperation | BulkAppendOperation | BulkDeleteOperation

type OperationTracker = { elementIds: string[], idMap: { [id: string]: { id: string, version: number, pos: string; index: number } } }

export type LastKnownOrderedElement = {id: string, version: number, pos: string}

export const getDeltaOperationsForYjs = (lastKnownElements: LastKnownOrderedElement[], newElements: readonly NonDeletedExcalidrawElement[], bulkify = true): {operations: Operation[], lastKnownElements: LastKnownOrderedElement[]} => {
  // Final operations are always in this order -> All updates + All appends + All deletes + All moves
  const updateOperations: UpdateOperation[] = []
  const appendOperations: AppendOperation[] = []
  const deleteOperations: DeleteOperation[] = []
  const moveOperations: MoveOperation[] = []

  // Updates the old elements as and when an operation is performed on it
  const opsTracker: OperationTracker = {
    elementIds: lastKnownElements.map((x) => x.id),
    // id map is needed to quickly look up index for the element with a given id
    idMap: lastKnownElements.reduce((map: any, data, index) => {
      map[data.id ] = { id: data.id, version: data.version, pos: data.pos, index }
      return map
    }, {})
  }

  const _updateIdIndexLookup = () => {
    opsTracker.idMap = opsTracker.elementIds.reduce((map: any, id, index) => {
      map[id] = { ...opsTracker.idMap[id], index }
      return map
    }, {})
  }

  for (let newElement of newElements) {
    let oldIndex: number | null = null;
    let oldElement: LastKnownOrderedElement | null = null
    if (opsTracker.idMap[newElement.id]) {
      const {index, ...rest} = opsTracker.idMap[newElement.id]
      oldIndex = index
      oldElement = rest
    }
    if (!oldElement) {
      // Always add at the end
      const op = {
        id: newElement.id, version: newElement.version, 
        pos: !bulkify ? generateKeyBetween(opsTracker.idMap[opsTracker.elementIds[opsTracker.elementIds.length - 1]]?.pos, null) : "",
        index: opsTracker.elementIds.length
      }
      opsTracker.elementIds.push(op.id);
      opsTracker.idMap[op.id] = op;
      appendOperations.push({ type: 'append', id: newElement.id, pos: op.pos, element: newElement })
    }
    else if (oldElement && newElement.version !== oldElement.version) {
      const op = {
        id: newElement.id, version: newElement.version, pos: oldElement.pos, index: oldIndex
      }
      opsTracker.idMap[newElement.id] = op
      updateOperations.push({ type: 'update', id: op.id, index: op.index, element: newElement })
    }
  }

  // Form delete operations
  // We are deleting from left to right
  const newElementIds = new Set(newElements.map((x) => x.id))
  const newOpsTrackerElementIds: string[] = []
  let runningIndex = 0
  for (let i = 0; i < opsTracker.elementIds.length; i++) {
    const id = opsTracker.elementIds[i]
    if (!newElementIds.has(id)) {
      deleteOperations.push({ type: 'delete', index: runningIndex, id })
    }
    else {
      newOpsTrackerElementIds.push(id)
      runningIndex += 1
    }
  }
  if (deleteOperations.length > 0) {
    // Update ops tracker
    opsTracker.elementIds = newOpsTrackerElementIds
    _updateIdIndexLookup()
  }

  // Find move operations
  for (let toIndex = 0; toIndex < newElements.length; toIndex++) {
    const id = newElements[toIndex].id
    const { index: fromIndex } = opsTracker.idMap[id]

    if (toIndex !== fromIndex) {
      // The move code was inspired by this comment -> https://discuss.yjs.dev/t/moving-elements-in-lists/92/15
      let leftSortIndex: string | null = null;
      let rightSortIndex: string | null = null;
      if (fromIndex >= 0 && fromIndex < toIndex) {
        // we're moving an item down in the list
        leftSortIndex = opsTracker.idMap[opsTracker.elementIds[toIndex]]?.pos || null;
        rightSortIndex = opsTracker.idMap[opsTracker.elementIds[toIndex + 1]]?.pos || null;
      } else {
        // we are moving up in list
        leftSortIndex = opsTracker.idMap[opsTracker.elementIds[toIndex - 1]]?.pos || null;
        rightSortIndex = opsTracker.idMap[opsTracker.elementIds[toIndex]]?.pos || null;
      }
      
      const newSortIndex = generateKeyBetween(leftSortIndex, rightSortIndex)
   
      // move to correct position, O(n)
      opsTracker.elementIds = moveArrayItem(opsTracker.elementIds, fromIndex, toIndex, true)
      opsTracker.idMap[id].pos = newSortIndex  // update the elements sort index
      _updateIdIndexLookup()  // update every items indices
      moveOperations.push({type: 'move', id, fromIndex, toIndex, pos: newSortIndex})
    }
  }

  const bulkAppendOperations: BulkAppendOperation[] = []
  const bulkDeleteOperations: BulkDeleteOperation[] = []
  if (bulkify) {
    // Merge append operations
    if (appendOperations.length > 0) {
      const sortIndexes = generateNKeysBetween(lastKnownElements[lastKnownElements.length - 1]?.pos, null, appendOperations.length)
      for (let [i, op] of appendOperations.entries()) {
        opsTracker.idMap[op.id].pos = sortIndexes[i]
      }
      bulkAppendOperations.push({
        type: 'bulkAppend',
        data: appendOperations.map((op, _index) => ({ id: op.id, pos: sortIndexes[_index], element: op.element }))
      })
    }

    // Merge continuos delete operations
    // deleteOperations is already sorted i.e items are deleted from left to right
    let lastIndex: number | null = null
    for (let op of deleteOperations) {
      if (lastIndex === null || op.index > lastIndex) {
        bulkDeleteOperations.push({
          type: 'bulkDelete',
          index: op.index,
          id: op.id,
          data: [{ id: op.id, index: op.index }]
        })
        lastIndex = op.index
      }
      else {
        bulkDeleteOperations[bulkDeleteOperations.length - 1].data.push({ id: op.id, index: op.index })
      }
    }
  }

  const operations: Operation[] = !bulkify ?
    [...updateOperations, ...appendOperations, ...deleteOperations, ...moveOperations] :
    [...updateOperations, ...bulkAppendOperations, ...bulkDeleteOperations, ...moveOperations]

  const updatedLastKnownElements = opsTracker.elementIds.map((x) => {
    const {index, ...rest} = opsTracker.idMap[x]
    return rest
  })
  
  // console.log("operations", operations)
  return {operations, lastKnownElements: updatedLastKnownElements};
}


export const applyOperations = (yArray: Y.Array<Y.Map<any>>, operations: Operation[]) => {
  // NOTE: yArray doesn't support a move operation (that is reordering elements within an array).
  // So to re-order the only way is to delete the element and insert it at the desired location
  // But that can lead to duplocation in some cases (when 1 person updates the same element and other reorders it)
  // So in order to avoid those cases, for sort order we are creating a new variable called pos which stores the fractoral index
  // We depend on that rather than the elements position in the array to get its correct ordering
  // See the post to understand more -> https://discuss.yjs.dev/t/moving-elements-in-lists/92/15
  // See this to understand more about fratcoral indexing -> https://observablehq.com/@dgreensp/implementing-fractional-indexing

  // Also we could have used yMap at top level rather than yArray
  // But yMaps at top level are not very efficient (memory wise). See this comment for more info -> https://discuss.yjs.dev/t/moving-elements-in-lists/92/23

  const _updateYjsIndexMap = () => {
    for (let i=0; i<yArray.length; i++) {
      let item = yArray.get(i).get("el") as ExcalidrawElement
      idYjsIndexMap[item.id] = i
    }
  }
  const idYjsIndexMap: {[key: string]: number} = {}
  _updateYjsIndexMap()

  yArray.doc!.transact(tr => {
    for (let op of operations) {
      switch (op.type) {
        case "update": {
          yArray.get(idYjsIndexMap[op.id]).set("el", op.element)
          break
        }
        case "append":
        case "bulkAppend": {
          if (op.type === "append") {
            idYjsIndexMap[op.id] = yArray.length;
            yArray.push([new Y.Map<ExcalidrawElement | string>(Object.entries({ pos: op.pos, el: op.element }))])
            
          }
          else {
            for (let i=0; i<op.data.length; i++) {
              idYjsIndexMap[op.data[i].id] = yArray.length + i;
            }
            yArray.push(
              op.data.map((x) => new Y.Map<any>(Object.entries({ pos: x.pos, el: x.element })))
            )
          }
          break
        }
        case "delete":
        case "bulkDelete": {
          if (op.type === "delete") {
            yArray.delete(idYjsIndexMap[op.id], 1)
          }
          else {
            yArray.delete(idYjsIndexMap[op.id], op.data.length)
          }
          _updateYjsIndexMap()
          break
        }
        case "move": {
          yArray.get(idYjsIndexMap[op.id]).set("pos", op.pos)
          break
        }
      }
    }
  }, this)
}