// Real-time synchronization using Server-Sent Events
class RealtimeSync {
  constructor() {
    this.eventSource = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.isConnected = false;
    this.listeners = {};
    
    this.connect();
  }

  connect() {
    try {
      this.eventSource = new EventSource('/api/events');
      
      this.eventSource.onopen = () => {
        console.log('✅ Real-time sync connected');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
      };

      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (err) {
          console.error('Error parsing SSE message:', err);
        }
      };

      this.eventSource.onerror = () => {
        console.error('❌ Real-time sync connection error');
        this.isConnected = false;
        this.eventSource.close();
        this.attemptReconnect();
      };

    } catch (err) {
      console.error('Error creating EventSource:', err);
      this.attemptReconnect();
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectDelay);
    
    // Exponential backoff
    this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000);
  }

  handleMessage(data) {
    console.log('📡 Received real-time update:', data.type);
    
    switch (data.type) {
      case 'connected':
        console.log(`Connected with client ID: ${data.clientId}`);
        break;
        
      case 'commands_updated':
        this.emit('commands_updated', data.data);
        break;
        
      case 'matches_updated':
        this.emit('matches_updated', data.data);
        break;
        
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  // Event listener system
  on(eventType, callback) {
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }
    this.listeners[eventType].push(callback);
  }

  off(eventType, callback) {
    if (this.listeners[eventType]) {
      this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);
    }
  }

  emit(eventType, data) {
    if (this.listeners[eventType]) {
      this.listeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in event listener:', err);
        }
      });
    }
  }

  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.isConnected = false;
    }
  }
}

// Create global instance
window.realtimeSync = new RealtimeSync();

// Auto-reconnect on page visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && !window.realtimeSync.isConnected) {
    console.log('Page became visible, attempting to reconnect...');
    window.realtimeSync.connect();
  }
});
