// server.js - Backend MQTT Publisher
const express = require('express');
const cors = require('cors');
const mqtt = require('mqtt');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Define API routes
const apiRouter = express.Router();

// Test MQTT Connection
apiRouter.post('/test-connection', (req, res) => {
  const { host, port, username, password } = req.body;
  
  if (!host || !port) {
    return res.status(400).json({ 
      success: false, 
      message: 'Host and port are required' 
    });
  }

  const url = `mqtt://${host}:${port}`;
  
  // Connection options
  const options = {
    connectTimeout: 10000, // Increased to 10 seconds
    reconnectPeriod: 0, // Don't auto reconnect for this test
    clean: true
  };
  
  if (username) options.username = username;
  if (password) options.password = password;

  try {
    console.log(`Attempting to connect to MQTT broker at ${url} with options:`, 
                JSON.stringify({...options, password: options.password ? '****' : undefined}));
    
    // Connect to MQTT broker
    const client = mqtt.connect(url, options);
    
    // Set timeout to handle slow connections
    const timeoutId = setTimeout(() => {
      client.end();
      return res.status(408).json({ 
        success: false, 
        message: 'Connection timeout - broker did not respond in time' 
      });
    }, 12000); // Increased to 12 seconds
    
    client.on('connect', () => {
      clearTimeout(timeoutId);
      console.log(`Successfully connected to MQTT broker at ${url}`);
      client.end();
      return res.status(200).json({ 
        success: true, 
        message: 'Connected successfully' 
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error('MQTT connection error:', err);
      return res.status(500).json({ 
        success: false, 
        message: `Connection error: ${err.message}`,
        details: `Check if the broker is running and accessible at ${host}:${port}`
      });
    });

    // Add specific handling for the 'offline' event
    client.on('offline', () => {
      clearTimeout(timeoutId);
      console.error('MQTT broker connection offline');
      client.end();
      return res.status(503).json({
        success: false,
        message: 'MQTT broker is unreachable or offline',
        details: `Check if the broker is running and accessible at ${host}:${port}`
      });
    });
    
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// MQTT Publish Route
apiRouter.post('/publish', (req, res) => {
  const { host, port, username, password, topic, message } = req.body;
  
  if (!host || !port || !topic || !message) {
    return res.status(400).json({ 
      success: false, 
      message: 'Missing required parameters' 
    });
  }

  const url = `mqtt://${host}:${port}`;
  
  // Connection options
  const options = {};
  if (username) options.username = username;
  if (password) options.password = password;

  try {
    // Connect to MQTT broker
    const client = mqtt.connect(url, options);
    
    client.on('connect', () => {
      console.log(`Connected to MQTT broker at ${url}`);
      
      // Publish message
      client.publish(topic, message, (err) => {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            message: 'Failed to publish message', 
            error: err.message 
          });
        }
        
        client.end();
        return res.status(200).json({ 
          success: true, 
          message: `Message published to topic '${topic}'` 
        });
      });
    });
    
    client.on('error', (err) => {
      console.error('MQTT connection error:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to connect to MQTT broker', 
        error: err.message 
      });
    });
    
  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: error.message 
    });
  }
});

// Use API router for all API routes
app.use('/api', apiRouter);

// Serve static files from the React build in production mode
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the React app
  app.use(express.static(path.join(__dirname, '../client/build')));
  
  // The "catchall" handler: for any request that doesn't
  // match one above, send back React's index.html file.
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
  });
}

// Start server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Export the Express API for Vercel serverless deployment
module.exports = app;