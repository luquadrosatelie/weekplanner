import { 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    deleteDoc,
    writeBatch,
    serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

import { db, firebaseAvailable } from './firebase-config.js';
import { getCurrentUser } from './auth.js';

// Save tasks to Firestore
export async function saveTasksToFirestore(tasks) {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        const batch = writeBatch(db);
        const userTasksRef = collection(db, 'users', user.uid, 'tasks');

        // First, get existing tasks to delete them
        const existingTasks = await getDocs(userTasksRef);
        existingTasks.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Add new tasks
        tasks.forEach((task) => {
            const taskRef = doc(userTasksRef, task.id);
            batch.set(taskRef, {
                ...task,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();
        console.log('Tasks saved to Firestore successfully');
    } catch (error) {
        console.error('Error saving tasks to Firestore:', error);
        throw error;
    }
}

// Load tasks from Firestore
export async function loadTasksFromFirestore() {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        const userTasksRef = collection(db, 'users', user.uid, 'tasks');
        const querySnapshot = await getDocs(userTasksRef);
        
        const tasks = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Convert Firestore timestamp to ISO string if needed
            if (data.updatedAt && data.updatedAt.toDate) {
                data.updatedAt = data.updatedAt.toDate().toISOString();
            }
            if (data.createdAt && data.createdAt.toDate) {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            tasks.push({ id: doc.id, ...data });
        });

        console.log('Tasks loaded from Firestore:', tasks.length);
        return tasks;
    } catch (error) {
        console.error('Error loading tasks from Firestore:', error);
        throw error;
    }
}

// Save scheduled tasks to Firestore
export async function saveScheduledTasksToFirestore(scheduledTasks) {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        const batch = writeBatch(db);
        const userScheduledTasksRef = collection(db, 'users', user.uid, 'scheduledTasks');

        // First, get existing scheduled tasks to delete them
        const existingScheduledTasks = await getDocs(userScheduledTasksRef);
        existingScheduledTasks.forEach((doc) => {
            batch.delete(doc.ref);
        });

        // Add new scheduled tasks
        scheduledTasks.forEach((scheduledTask) => {
            const scheduledTaskRef = doc(userScheduledTasksRef, scheduledTask.id);
            batch.set(scheduledTaskRef, {
                ...scheduledTask,
                updatedAt: serverTimestamp()
            });
        });

        await batch.commit();
        console.log('Scheduled tasks saved to Firestore successfully');
    } catch (error) {
        console.error('Error saving scheduled tasks to Firestore:', error);
        throw error;
    }
}

// Load scheduled tasks from Firestore
export async function loadScheduledTasksFromFirestore() {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        const userScheduledTasksRef = collection(db, 'users', user.uid, 'scheduledTasks');
        const querySnapshot = await getDocs(userScheduledTasksRef);
        
        const scheduledTasks = [];
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            // Convert Firestore timestamp to ISO string if needed
            if (data.updatedAt && data.updatedAt.toDate) {
                data.updatedAt = data.updatedAt.toDate().toISOString();
            }
            if (data.createdAt && data.createdAt.toDate) {
                data.createdAt = data.createdAt.toDate().toISOString();
            }
            scheduledTasks.push({ id: doc.id, ...data });
        });

        console.log('Scheduled tasks loaded from Firestore:', scheduledTasks.length);
        return scheduledTasks;
    } catch (error) {
        console.error('Error loading scheduled tasks from Firestore:', error);
        throw error;
    }
}

// Migrate local data to Firestore
export async function migrateLocalDataToFirestore(localTasks, localScheduledTasks) {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        console.log('Migrating local data to Firestore...');
        
        // Save tasks and scheduled tasks to Firestore
        await Promise.all([
            saveTasksToFirestore(localTasks),
            saveScheduledTasksToFirestore(localScheduledTasks)
        ]);

        // Clear local storage after successful migration
        localStorage.removeItem('weeklyPlannerTasks');
        localStorage.removeItem('weeklyPlannerScheduledTasks');

        console.log('Local data migrated to Firestore successfully');
    } catch (error) {
        console.error('Error migrating local data to Firestore:', error);
        throw error;
    }
}

// Delete a specific task from Firestore
export async function deleteTaskFromFirestore(taskId) {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', taskId);
        await deleteDoc(taskRef);
        console.log('Task deleted from Firestore:', taskId);
    } catch (error) {
        console.error('Error deleting task from Firestore:', error);
        throw error;
    }
}

// Delete a specific scheduled task from Firestore
export async function deleteScheduledTaskFromFirestore(scheduledTaskId) {
    if (!firebaseAvailable || !db) {
        throw new Error('Firestore não está disponível');
    }

    const user = getCurrentUser();
    if (!user) {
        throw new Error('Usuário não autenticado');
    }

    try {
        const scheduledTaskRef = doc(db, 'users', user.uid, 'scheduledTasks', scheduledTaskId);
        await deleteDoc(scheduledTaskRef);
        console.log('Scheduled task deleted from Firestore:', scheduledTaskId);
    } catch (error) {
        console.error('Error deleting scheduled task from Firestore:', error);
        throw error;
    }
}
