# ioBroker Adapter Development with GitHub Copilot

**Version:** 0.4.0
**Template Source:** https://github.com/DrozmotiX/ioBroker-Copilot-Instructions

This file contains instructions and best practices for GitHub Copilot when working on ioBroker adapter development.

## Project Context

You are working on an ioBroker adapter. ioBroker is an integration platform for the Internet of Things, focused on building smart home and industrial IoT solutions. Adapters are plugins that connect ioBroker to external systems, devices, or services.

## Adapter-Specific Context

**Adapter Name**: ioBroker.broadlink2  
**Primary Function**: Controls BroadLink compatible wireless devices including RM++ (IR/RF remotes), SP++ (smart plugs), A1 (environmental sensors), T1 (thermostats), S1C (security devices), Floureon, LB1 (smart bulbs), and other OEM products.

**Key Features**:
- Network scanning and automatic device discovery
- IR/RF remote control learning and transmission (RM series)
- Smart switch control and status polling (SP series)  
- Environmental monitoring (A1 sensors)
- Scene execution (actions on multiple devices)
- Device state management and persistence

**Hardware Communication**:
- UDP broadcast for device discovery on local network
- Direct IP communication with individual devices
- Device authentication and encryption protocols
- Support for cross-network device access

**Device Categories**:
- **RM Series**: IR/RF remote controllers (RM2, RM3, RM4, RM Mini, RM Pro, etc.)
- **SP Series**: Smart plugs/switches (SP1, SP2, SP3, SPMini, etc.) 
- **Environmental**: A1 sensors (temperature, humidity, air quality)
- **Lighting**: LB1 smart bulbs with color/brightness control
- **Security**: S1C door sensors and motion detectors

## Testing

### Unit Testing
- Use Jest as the primary testing framework for ioBroker adapters
- Create tests for all adapter main functions and helper methods
- Test error handling scenarios and edge cases
- Mock external API calls and hardware dependencies
- For adapters connecting to APIs/devices not reachable by internet, provide example data files to allow testing of functionality without live connections
- Example test structure:
  ```javascript
  describe('AdapterName', () => {
    let adapter;
    
    beforeEach(() => {
      // Setup test adapter instance
    });
    
    test('should initialize correctly', () => {
      // Test adapter initialization
    });
  });
  ```

### Integration Testing

**IMPORTANT**: Use the official `@iobroker/testing` framework for all integration tests. This is the ONLY correct way to test ioBroker adapters.

**Official Documentation**: https://github.com/ioBroker/testing

#### Framework Structure
Integration tests MUST follow this exact pattern:

```javascript
const path = require('path');
const { tests } = require('@iobroker/testing');

// Define test coordinates or configuration
const TEST_COORDINATES = '52.520008,13.404954'; // Berlin
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Use tests.integration() with defineAdditionalTests
tests.integration(path.join(__dirname, '..'), {
    defineAdditionalTests({ suite }) {
        suite('Test adapter with specific configuration', (getHarness) => {
            let harness;

            before(() => {
                harness = getHarness();
            });

            it('should configure and start adapter', function () {
                return new Promise(async (resolve, reject) => {
                    try {
                        harness = getHarness();
                        
                        // Get adapter object using promisified pattern
                        const obj = await new Promise((res, rej) => {
                            harness.objects.getObject('system.adapter.your-adapter.0', (err, o) => {
                                if (err) return rej(err);
                                res(o);
                            });
                        });
                        
                        if (!obj) {
                            return reject(new Error('Adapter object not found'));
                        }

                        // Configure adapter properties
                        Object.assign(obj.native, {
                            position: TEST_COORDINATES,
                            createCurrently: true,
                            createHourly: true,
                            createDaily: true,
                            // Add other configuration as needed
                        });

                        // Set the updated configuration
                        harness.objects.setObject(obj._id, obj);

                        console.log('✅ Step 1: Configuration written, starting adapter...');
                        
                        // Start adapter and wait
                        await harness.startAdapterAndWait();
                        
                        console.log('✅ Step 2: Adapter started');

                        // Wait for adapter to process data
                        const waitMs = 15000;
                        await wait(waitMs);

                        console.log('🔍 Step 3: Checking states after adapter run...');
                        
                        resolve();
                    } catch (error) {
                        console.error('❌ Test failed:', error.message);
                        reject(error);
                    }
                }).timeout(120000);
            });
        });
    }
});
```

#### Broadlink2-Specific Testing Patterns

For testing Broadlink device interactions without physical hardware:

```javascript
describe('Broadlink Device Communication', () => {
    beforeEach(() => {
        // Mock network discovery
        mockDiscovery = sinon.stub(broadlink, 'discover').resolves([mockDevice]);
        
        // Mock device authentication 
        mockAuth = sinon.stub(mockDevice, 'auth').resolves(true);
        
        // Mock command sending
        mockSendData = sinon.stub(mockDevice, 'sendData').resolves();
    });

    test('should discover devices on network', async () => {
        const devices = await adapter.scanDevices();
        expect(devices).toBeDefined();
        expect(mockDiscovery.called).toBe(true);
    });
    
    test('should handle device authentication failure', async () => {
        mockAuth.rejects(new Error('Auth failed'));
        await expect(adapter.authenticateDevice(mockDevice)).rejects.toThrow('Auth failed');
    });
});
```

## Error Handling and Logging Patterns

### Device Connection Errors
```javascript
try {
    await device.auth();
    await device.sendData(command);
} catch (error) {
    if (error.code === 'EHOSTUNREACH') {
        this.log.warn(`Device ${deviceName} unreachable - marking as offline`);
        await this.setState(`${deviceId}.info.connection`, false, true);
    } else if (error.message.includes('Authentication')) {
        this.log.error(`Device ${deviceName} authentication failed - check device setup`);
    } else {
        this.log.error(`Device ${deviceName} communication error: ${error.message}`);
    }
}
```

### Network Discovery Error Handling
```javascript
async scanForDevices() {
    try {
        const devices = await broadlink.discover({
            address: this.config.interface || undefined
        });
        
        if (devices.length === 0) {
            this.log.info('No Broadlink devices found on network');
            return [];
        }
        
        return devices;
    } catch (error) {
        this.log.error(`Network scan failed: ${error.message}`);
        if (error.code === 'EADDRINUSE') {
            this.log.error('Network interface busy - try different interface or restart adapter');
        }
        return [];
    }
}
```

## Device State Management

### State Structure for Broadlink Devices
```javascript
// RM Series (IR/RF Controllers)
await this.setObjectNotExists(`${deviceId}.commands.learn`, {
    type: 'state',
    common: {
        name: 'Learn IR/RF Command',
        type: 'boolean',
        role: 'button',
        read: false,
        write: true
    }
});

// SP Series (Smart Plugs) 
await this.setObjectNotExists(`${deviceId}.switch`, {
    type: 'state',
    common: {
        name: 'Switch State',
        type: 'boolean', 
        role: 'switch',
        read: true,
        write: true
    }
});

// A1 Series (Environmental Sensors)
await this.setObjectNotExists(`${deviceId}.temperature`, {
    type: 'state',
    common: {
        name: 'Temperature',
        type: 'number',
        role: 'value.temperature',
        unit: '°C',
        read: true,
        write: false
    }
});
```

### Learned Command Storage
```javascript
async storeLearnedCommand(deviceId, commandName, hexData) {
    const stateId = `${deviceId}.commands.${commandName}`;
    
    await this.setObjectNotExists(stateId, {
        type: 'state',
        common: {
            name: commandName,
            type: 'boolean',
            role: 'button',
            read: false,
            write: true
        },
        native: {
            code: hexData,  // Store hex code in native section
            deviceType: 'RM',
            learned: true
        }
    });
}
```

## Configuration Validation

### Network Interface Validation
```javascript
validateNetworkConfig(config) {
    const errors = [];
    
    if (config.interface) {
        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(config.interface)) {
            errors.push('Invalid IP address format for interface');
        }
    }
    
    if (config.poll && (config.poll < 0 || config.poll > 3600)) {
        errors.push('Poll interval must be between 0 and 3600 seconds');
    }
    
    return errors;
}
```

## Polling and Device Updates

### Safe Polling Implementation
```javascript
async pollDeviceStates() {
    if (!this.config.poll || this.config.poll === 0) return;
    
    for (const [deviceId, device] of Object.entries(this.devices)) {
        try {
            if (device.type.startsWith('SP') && device.type !== 'SP1') {
                const powered = await device.check_power();
                await this.setState(`${deviceId}.switch`, powered, true);
            }
            
            if (device.type === 'A1') {
                const data = await device.check_sensors();
                if (data.temperature !== undefined) {
                    await this.setState(`${deviceId}.temperature`, data.temperature, true);
                }
                if (data.humidity !== undefined) {
                    await this.setState(`${deviceId}.humidity`, data.humidity, true);
                }
            }
        } catch (error) {
            this.log.debug(`Failed to poll device ${deviceId}: ${error.message}`);
        }
    }
    
    this.pollTimeout = setTimeout(() => this.pollDeviceStates(), this.config.poll * 1000);
}
```

## Scene Management

### Scene Execution with Error Recovery
```javascript
async executeScene(sceneName, sceneCommands) {
    this.log.info(`Executing scene: ${sceneName}`);
    
    for (const command of sceneCommands) {
        try {
            if (command.delay) {
                await this.delay(command.delay);
                continue;
            }
            
            const [deviceId, action, value] = command.split(',');
            const device = this.devices[deviceId];
            
            if (!device) {
                this.log.warn(`Scene ${sceneName}: Device ${deviceId} not found`);
                continue;
            }
            
            await this.executeDeviceCommand(device, action, value);
            
        } catch (error) {
            this.log.error(`Scene ${sceneName}: Command failed - ${error.message}`);
            // Continue with remaining commands even if one fails
        }
    }
}
```

## Cleanup and Resource Management

```javascript
async onUnload(callback) {
    try {
        // Clear polling timeouts
        if (this.pollTimeout) {
            clearTimeout(this.pollTimeout);
            this.pollTimeout = undefined;
        }
        
        // Clear device reconnection timers
        Object.values(this.reconnectTimers || {}).forEach(timer => {
            clearTimeout(timer);
        });
        
        // Close device connections
        Object.values(this.devices || {}).forEach(device => {
            if (device && typeof device.close === 'function') {
                try {
                    device.close();
                } catch (error) {
                    this.log.debug(`Error closing device: ${error.message}`);
                }
            }
        });
        
        this.log.info('Broadlink2 adapter stopped');
        callback();
    } catch (error) {
        this.log.error(`Error during unload: ${error.message}`);
        callback();
    }
}
```

## Code Style and Standards

- Follow JavaScript/TypeScript best practices
- Use async/await for asynchronous operations
- Implement proper resource cleanup in `unload()` method
- Use semantic versioning for adapter releases
- Include proper JSDoc comments for public methods

## CI/CD and Testing Integration

### GitHub Actions for API Testing
For adapters with external API dependencies, implement separate CI/CD jobs:

```yaml
# Tests API connectivity with demo credentials (runs separately)
demo-api-tests:
  if: contains(github.event.head_commit.message, '[skip ci]') == false
  
  runs-on: ubuntu-22.04
  
  steps:
    - name: Checkout code
      uses: actions/checkout@v4
      
    - name: Use Node.js 20.x
      uses: actions/setup-node@v4
      with:
        node-version: 20.x
        cache: 'npm'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run demo API tests
      run: npm run test:integration-demo
```

### CI/CD Best Practices
- Run credential tests separately from main test suite
- Use ubuntu-22.04 for consistency
- Don't make credential tests required for deployment
- Provide clear failure messages for API connectivity issues
- Use appropriate timeouts for external API calls (120+ seconds)

### Package.json Script Integration
Add dedicated script for credential testing:
```json
{
  "scripts": {
    "test:integration-demo": "mocha test/integration-demo --exit"
  }
}
```

### Practical Example: Complete API Testing Implementation
Here's a complete example based on lessons learned from the Discovergy adapter:

#### test/integration-demo.js
```javascript
const path = require("path");
const { tests } = require("@iobroker/testing");

// Helper function to encrypt password using ioBroker's encryption method
async function encryptPassword(harness, password) {
    const systemConfig = await harness.objects.getObjectAsync("system.config");
    
    if (!systemConfig || !systemConfig.native || !systemConfig.native.secret) {
        throw new Error("Could not retrieve system secret for password encryption");
    }
    
    const secret = systemConfig.native.secret;
    let result = '';
    for (let i = 0; i < password.length; ++i) {
        result += String.fromCharCode(secret[i % secret.length].charCodeAt(0) ^ password.charCodeAt(i));
    }
    
    return result;
}

// Run integration tests with demo credentials
tests.integration(path.join(__dirname, ".."), {
    defineAdditionalTests({ suite }) {
        suite("API Testing with Demo Credentials", (getHarness) => {
            let harness;
            
            before(() => {
                harness = getHarness();
            });

            it("Should connect to API and initialize with demo credentials", async () => {
                console.log("Setting up demo credentials...");
                
                if (harness.isAdapterRunning()) {
                    await harness.stopAdapter();
                }
                
                const encryptedPassword = await encryptPassword(harness, "demo_password");
                
                await harness.changeAdapterConfig("your-adapter", {
                    native: {
                        username: "demo@provider.com",
                        password: encryptedPassword,
                        // other config options
                    }
                });

                console.log("Starting adapter with demo credentials...");
                await harness.startAdapter();
                
                // Wait for API calls and initialization
                await new Promise(resolve => setTimeout(resolve, 60000));
                
                const connectionState = await harness.states.getStateAsync("your-adapter.0.info.connection");
                
                if (connectionState && connectionState.val === true) {
                    console.log("✅ SUCCESS: API connection established");
                    return true;
                } else {
                    throw new Error("API Test Failed: Expected API connection to be established with demo credentials. " +
                        "Check logs above for specific API errors (DNS resolution, 401 Unauthorized, network issues, etc.)");
                }
            }).timeout(120000);
        });
    }
});
```

## JSON Configuration (Admin UI)

### Using jsonConfig for Modern Admin UI
This adapter uses jsonConfig for a modern admin interface. Key patterns:

```javascript
// State validation in adapter code
validateConfig(config) {
    const errors = [];
    
    if (config.poll && (config.poll < 0 || config.poll > 3600)) {
        errors.push('Poll interval must be between 0-3600 seconds');
    }
    
    if (config.interface && !this.isValidIP(config.interface)) {
        errors.push('Invalid interface IP address');
    }
    
    return errors;
}

// Apply configuration changes
async onReady() {
    const errors = this.validateConfig(this.config);
    if (errors.length > 0) {
        this.log.error(`Configuration errors: ${errors.join(', ')}`);
        return;
    }
    
    // Proceed with adapter initialization
}
```

### Configuration Encryption
```javascript
// Encrypt sensitive configuration data
encryptConfig(config) {
    if (config.password && !config.password.startsWith('ENCRYPTED:')) {
        config.password = 'ENCRYPTED:' + this.encrypt(config.password);
    }
    return config;
}

// Decrypt configuration data  
decryptConfig(config) {
    if (config.password && config.password.startsWith('ENCRYPTED:')) {
        config.password = this.decrypt(config.password.substring(10));
    }
    return config;
}
```

## WebSocket and Real-time Updates

### Device State Broadcasting
```javascript
// Broadcast device state changes to admin UI
broadcastDeviceUpdate(deviceId, state, value) {
    if (this.supportsFeature && this.supportsFeature('ADMIN_UI')) {
        this.sendTo('admin', 'deviceStateChanged', {
            deviceId: deviceId,
            state: state,
            value: value,
            timestamp: Date.now()
        });
    }
}

// Handle real-time device discovery updates
onDeviceDiscovered(device) {
    this.log.info(`New device found: ${device.type} at ${device.host}`);
    this.broadcastDeviceUpdate(device.mac, 'discovered', {
        type: device.type,
        host: device.host,
        mac: device.mac
    });
}
```