import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';

// Create the Y.Doc instance and Y.Array of Y.Map elements
const ydoc = new Y.Doc();
const yElements = ydoc.getArray<Y.Map<any>>('elements');
const undoManager = new Y.UndoManager(yElements, {captureTimeout: 0})

const clone = (data) => JSON.parse(JSON.stringify(data))

const setInitiaData = () => {
  ydoc.transact(() => {
    const newItem = new Y.Map();
    newItem.set("el", {
      "type": "rectangle",
      "version": 24,
      "versionNonce": 930018096,
      "isDeleted": false,
      "id": "Ili1OSd0gXLbqz9I-skEI",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "x": 743.7999877929688,
      "y": 63.40003204345703,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "#ffc9c9",
      "width": 176,
      "height": 195.99998474121094,
      "seed": 827052496,
      "groupIds": [],
      "frameId": null,
      "roundness": {
          "type": 3
      },
      "boundElements": [],
      "updated": 1729049350289,
      "link": null,
      "locked": false
  })
  newItem.set("pos", "a0")
  yElements.push([newItem])

  const newItem2 = new Y.Map();
  newItem2.set("el", {
      "type": "rectangle",
      "version": 48,
      "versionNonce": 2106133808,
      "isDeleted": false,
      "id": "7b5Rv-1t6VS5O8G9AcWLE",
      "fillStyle": "solid",
      "strokeWidth": 2,
      "strokeStyle": "solid",
      "roughness": 1,
      "opacity": 100,
      "angle": 0,
      "x": 866.2000122070312,
      "y": 179.40003204345703,
      "strokeColor": "#1e1e1e",
      "backgroundColor": "#b2f2bb",
      "width": 168,
      "height": 160.79991149902344,
      "seed": 1905334224,
      "groupIds": [],
      "frameId": null,
      "roundness": {
          "type": 3
      },
      "boundElements": [],
      "updated": 1729049350290,
      "link": null,
      "locked": false
  })
  newItem2.set("pos", "b0")
  yElements.push([newItem2])
  })
}
setInitiaData()
console.log('initial', clone(yElements.toJSON()))

const App: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [index, setIndex] = useState<number>(0); // To store the index from input

  const updateFromYjs = () => {
    // Convert each Y.Map to a plain object for rendering
    const plainItems = yElements.map((item: Y.Map<any>) => ({
      pos: item.get("pos"),
      el: item.get("el")
    }));
    // setItems(plainItems.sort((a, b) => a.pos < b.pos ? - 1 : (a.pos === b.pos ? 0 : 1)));
    setItems(plainItems);
  };


  // Sync the Yjs array with React state when the component mounts
  useEffect(() => {
    // Listen to changes in the Yjs array
    yElements.observeDeep(updateFromYjs);

    // // Initialize the items state with the current Yjs array values
    // updateFromYjs();

    // Cleanup the observer on unmount
    return () => {
      yElements.unobserve(updateFromYjs);
    };
  }, []);

  // Add a new Y.Map item to the Yjs array
  const addItem = () => {
    ydoc.transact(() => {
      const newItem = new Y.Map();
      newItem.set('id', (yElements.length + 1).toString());
      newItem.set('name', `Item ${yElements.length + 1}`);
      yElements.push([newItem]);
    })
  };

  // Update the item at the specified index in the Yjs array
  const updateItem = () => {
    ydoc.transact(() => {
      if (index >= 0 && index < yElements.length) {
        const itemToUpdate = yElements.get(index) as Y.Map<any>;
        itemToUpdate.set('name', `Item ${index + 1} - ${crypto.randomUUID().slice(0, 8)}`);
      } else {
        alert('Invalid index');
      }
    })
  };

  // Delete the item at the specified index in the Yjs array
  const deleteItem = () => {
    ydoc.transact(() => {
      if (index >= 0 && index < yElements.length) {
        yElements.delete(index, 1);
      } else {
        alert('Invalid index');
      }
    })
  };


  // Delete the item at the specified index in the Yjs array
  const moveItem = () => {
    ydoc.transact(() => {
      const el = yElements.get(1).get("el")
      yElements.get(1).set("pos", "Z1")
      yElements.get(1).set("el", {...el, version: el.version + 1})
    })
    console.log('move', clone(yElements.toJSON()))
  };

  // Undo and Redo logic (placeholder)
  const undo = () => {
    console.log("Undo clicked");
    undoManager.undo()
    console.log('undo', clone(yElements.toJSON()))
  };

  const redo = () => {
    console.log("Redo clicked");
    undoManager.redo()
    console.log('redo', clone(yElements.toJSON()))
  };

  // set init data
  

  useEffect(() => {
    updateFromYjs()

    // Placeholder for setting up undo/redo listeners
    const setupUndoRedoListeners = () => {
      // Setup listeners (if needed)
      console.log('Undo/Redo listeners set up');
    };

    const cleanupUndoRedoListeners = () => {
      // Cleanup listeners (if needed)
      console.log('Undo/Redo listeners cleaned up');
    };

    // Setup on component mount
    setupUndoRedoListeners();

    // Cleanup on component unmount
    return () => {
      cleanupUndoRedoListeners();
    };
  }, []);

  // Handle input change for index
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIndex(parseInt(e.target.value) || 0);
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Yjs Array Items (Y.Map Format)</h2>
      <pre>{JSON.stringify(items, null, 2)}</pre>

      <div style={{ marginTop: '20px' }}>
        <button onClick={addItem} style={{ marginRight: '10px' }}>Add</button>
        <button onClick={updateItem} style={{ marginRight: '10px' }}>Update</button>
        <button onClick={deleteItem} style={{ marginRight: '10px' }}>Delete</button>
        <button onClick={moveItem} style={{ marginRight: '10px' }}>Move</button>
        <button onClick={undo} style={{ marginRight: '10px' }}>Undo</button>
        <button onClick={redo}>Redo</button>
      </div>

      <div style={{ marginTop: '20px' }}>
        <label>Index: </label>
        <input type="number" value={index} onChange={handleInputChange} />
      </div>
    </div>
  );
};

export default App;
