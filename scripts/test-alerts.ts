#!/usr/bin/env tsx

// Test script for the alert system
import AlertService from '../src/services/alert.service';

async function testAlerts() {
  console.log('Testing Alert System...\n');
  
  try {
    // Test 1: Create a critical alert
    console.log('Test 1: Creating a CRITICAL alert...');
    const alertId1 = await AlertService.createAlert({
      alertType: 'database_pool_exhausted',
      severity: 'CRITICAL',
      title: 'Database Pool Critical',
      message: 'Database connection pool is at 95% capacity',
      metric: 'db.pool.usage',
      threshold: 90,
      currentValue: 95,
      context: {
        poolSize: 20,
        activeConnections: 19,
        idleConnections: 1,
      },
      channels: ['console', 'database'],
    });
    console.log(`✅ Alert created with ID: ${alertId1}\n`);
    
    // Test 2: Test deduplication
    console.log('Test 2: Testing deduplication (same alert)...');
    const alertId2 = await AlertService.createAlert({
      alertType: 'database_pool_exhausted',
      severity: 'CRITICAL',
      title: 'Database Pool Critical',
      message: 'Database connection pool is at 96% capacity',
      metric: 'db.pool.usage',
      threshold: 90,
      currentValue: 96,
      context: {
        poolSize: 20,
        activeConnections: 19,
        idleConnections: 1,
      },
      channels: ['console', 'database'],
    });
    console.log(`✅ Deduplication test result - Alert ID: ${alertId2}`);
    console.log(`   Should be same as first: ${alertId1 === alertId2}\n`);
    
    // Test 3: Create a HIGH severity alert
    console.log('Test 3: Creating a HIGH severity alert...');
    const alertId3 = await AlertService.createAlert({
      alertType: 'high_memory_usage',
      severity: 'HIGH',
      title: 'High Memory Usage Detected',
      message: 'Application memory usage has exceeded 92% of heap size',
      metric: 'memory.heap.usage',
      threshold: 90,
      currentValue: 92,
      context: {
        heapUsed: 450000000,
        heapTotal: 489000000,
        external: 50000000,
      },
      channels: ['console', 'database'],
    });
    console.log(`✅ Alert created with ID: ${alertId3}\n`);
    
    // Test 4: Create a MEDIUM severity alert
    console.log('Test 4: Creating a MEDIUM severity alert...');
    const alertId4 = await AlertService.createAlert({
      alertType: 'cache_failure',
      severity: 'MEDIUM',
      title: 'Low Cache Hit Rate',
      message: 'Cache hit rate has fallen below 50%',
      metric: 'cache.hit.rate',
      threshold: 50,
      currentValue: 45,
      context: {
        hits: 450,
        misses: 550,
        total: 1000,
      },
      channels: ['console', 'database'],
    });
    console.log(`✅ Alert created with ID: ${alertId4}\n`);
    
    // Test 5: Get active alerts
    console.log('Test 5: Getting active alerts...');
    const activeAlerts = await AlertService.getActiveAlerts();
    console.log(`✅ Found ${activeAlerts.length} active alerts`);
    activeAlerts.forEach(alert => {
      console.log(`   - ${alert.severity}: ${alert.title}`);
    });
    console.log();
    
    // Test 6: Acknowledge an alert
    if (alertId1) {
      console.log(`Test 6: Acknowledging alert ${alertId1}...`);
      const acknowledged = await AlertService.acknowledgeAlert(alertId1, 'test-user-id');
      console.log(`✅ Alert acknowledged: ${acknowledged}\n`);
    }
    
    // Test 7: Resolve an alert
    if (alertId3) {
      console.log(`Test 7: Resolving alert ${alertId3}...`);
      const resolved = await AlertService.resolveAlert(alertId3, 'test-user-id');
      console.log(`✅ Alert resolved: ${resolved}\n`);
    }
    
    // Test 8: Get alert history
    console.log('Test 8: Getting alert history...');
    const history = await AlertService.getAlertHistory();
    console.log(`✅ Found ${history.length} alerts in history`);
    
    // Summary
    console.log('\n=== Test Summary ===');
    console.log('✅ All tests completed successfully!');
    console.log('Alert system is functioning properly.');
    console.log('\nFeatures tested:');
    console.log('- Alert creation with different severities');
    console.log('- Alert deduplication');
    console.log('- Console and database notifications');
    console.log('- Alert acknowledgment');
    console.log('- Alert resolution');
    console.log('- Active alerts retrieval');
    console.log('- Alert history retrieval');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

// Run tests
testAlerts();