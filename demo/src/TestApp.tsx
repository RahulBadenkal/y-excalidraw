import React, { useEffect, useState } from 'react';
import * as Y from 'yjs';

// Create the Y.Doc instance and Y.Array of Y.Map elements
const ydoc = new Y.Doc();
const yElements = ydoc.getArray<Y.Map<any>>('elements');
const undoManager = new Y.UndoManager(yElements)

const setInitiaData = () => {
  ydoc.transact(() => {
    const newItem = new Y.Map();
    newItem.set('id', (yElements.length + 1).toString());
    newItem.set('name', `Item ${yElements.length + 1}`);
    yElements.push([newItem]);

    const newItem2 = new Y.Map();
    newItem2.set('id', (yElements.length + 1).toString());
    newItem2.set('name', `Item ${yElements.length + 1}`);
    yElements.push([newItem2]);
  })
}
setInitiaData()

const App: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [index, setIndex] = useState<number>(0); // To store the index from input

  // Sync the Yjs array with React state when the component mounts
  useEffect(() => {
    const updateFromYjs = () => {
      // Convert each Y.Map to a plain object for rendering
      const plainItems = yElements.map((item: Y.Map<any>) => ({
        id: item.get('id'),
        name: item.get('name')
      }));
      setItems(plainItems);
    };

    // Listen to changes in the Yjs array
    yElements.observeDeep(updateFromYjs);

    // Initialize the items state with the current Yjs array values
    updateFromYjs();

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

  // Undo and Redo logic (placeholder)
  const undo = () => {
    console.log("Undo clicked");
    undoManager.undo()
  };

  const redo = () => {
    console.log("Redo clicked");
    undoManager.redo()
  };

  // set init data
  

  useEffect(() => {
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
