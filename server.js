// Import Express framework
const express = require('express');

// Initialize the Express application
const app = express();

// Set the port to 5000
const PORT = 5000;

// Enable JSON body parsing middleware (express.json())
app.use(express.json());

// In-memory data store for tasks
let tasks = [];
let nextId = 1; // Counter to generate unique sequential IDs

// 1. Global Logging Middleware
// Logs the HTTP method, request URL, and current timestamp
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${req.method} ${req.url} - ${timestamp}`);
  next();
});

// --- CRUD API Routes ---

// GET /tasks - Return all tasks
app.get('/tasks', (req, res) => {
  res.status(200).json(tasks);
});

// POST /tasks - Create a task
app.post('/tasks', (req, res, next) => {
  try {
    const { title } = req.body;
    
    // Create task object with unique sequential ID
    const newTask = {
      id: nextId++,
      title: title || ""
    };
    
    // Push the task to the in-memory array
    tasks.push(newTask);
    
    // Return created task with 201 status code
    res.status(201).json(newTask);
  } catch (error) {
    // Pass the error to the global error-handling middleware
    next(error);
  }
});

// PUT /tasks/:id - Update task title
app.put('/tasks/:id', (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    const { title } = req.body;
    
    // Find the task inside the array
    const task = tasks.find(t => t.id === taskId);
    
    // If the task does not exist, return 404 status code
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Update the title
    task.title = title || task.title;
    
    // Return the updated task with 200 status code
    res.status(200).json(task);
  } catch (error) {
    // Pass the error to the global error-handling middleware
    next(error);
  }
});

// DELETE /tasks/:id - Delete task
app.delete('/tasks/:id', (req, res, next) => {
  try {
    const taskId = parseInt(req.params.id, 10);
    
    // Find the index of the task in the array
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    // If the task does not exist, return 404 status code
    if (taskIndex === -1) {
      return res.status(404).json({ error: "Task not found" });
    }
    
    // Remove the task from the array
    tasks.splice(taskIndex, 1);
    
    // Return success message with 200 status code
    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    // Pass the error to the global error-handling middleware
    next(error);
  }
});

// 2. Global Error Handler Middleware
// It MUST be the LAST app.use()
app.use((err, req, res, next) => {
  console.error("Error encountered:", err.message || err);
  res.status(500).json({
    error: "Something went wrong"
  });
});

// Start the server and listen on port 5000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
