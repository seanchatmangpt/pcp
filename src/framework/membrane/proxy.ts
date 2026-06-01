import { Membrane } from './membrane';
import { ProxyWrapperOptions, MembraneTelemetryEvent } from './types';

const IS_PROXY = Symbol('IS_PROXY');
const proxyCache = new WeakMap<object, any>();

export class ProxyFactory {
  /**
   * Wraps a target object in a JS Proxy governed by the given Membrane instance
   */
  public static wrap<T extends object>(
    target: T,
    membrane: Membrane,
    options: ProxyWrapperOptions = {}
  ): T {
    if (!target) {
      return target;
    }

    // Avoid double proxying
    if ((target as any)[IS_PROXY]) {
      return target;
    }

    // Proxy performance optimization: cache proxies to prevent recreating
    if (proxyCache.has(target)) {
      return proxyCache.get(target) as T;
    }

    const emit = (event: MembraneTelemetryEvent) => {
      // Ignore symbols in telemetry to prevent pollution
      if (typeof event.property === 'string' && event.property.startsWith('Symbol(')) {
        return;
      }
      if (options.onTelemetry) {
        options.onTelemetry(event);
      }
      membrane.telemetry.emit(event);
    };

    let activeTrap: 'set' | 'get' | 'delete' | 'define' | null = null;

    const handler: ProxyHandler<T> = {
      set: (obj, prop, value, receiver) => {
        if (activeTrap) {
          return Reflect.set(obj, prop, value, receiver);
        }
        activeTrap = 'set';
        try {
          const commandId = `cmd_set_${String(prop)}_${Date.now()}`;
          const originalVal = Reflect.get(obj, prop, receiver);

          // Optimistically set the value
          const setSuccess = Reflect.set(obj, prop, value, receiver);
          if (!setSuccess) {
            return false;
          }

          if (options.onMutation) {
            options.onMutation(prop, value);
          }

          emit({
            timestamp: new Date().toISOString(),
            type: 'set',
            property: String(prop),
            originalValue: originalVal,
            value,
            flowName: options.flowName,
            success: undefined,
          });

          const input = {
            property: String(prop),
            value,
            flowName: options.flowName,
            fromState: originalVal,
            toState: value,
          };

          // Run async membrane checking in background
          membrane
            .run('property-mutator', commandId, input, async () => {
              return true;
            })
            .then((res) => {
              if (!res.success) {
                // Rollback optimistic write if membrane denies/fails
                // Note: Use direct set on target to bypass proxy set trap during rollback
                Reflect.set(obj, prop, originalVal);
                if (options.onMutation) {
                  options.onMutation(prop, originalVal);
                }
                emit({
                  timestamp: new Date().toISOString(),
                  type: 'rollback',
                  property: String(prop),
                  originalValue: value,
                  value: originalVal,
                  flowName: options.flowName,
                  success: false,
                  error: res.error || 'Transition denied',
                });
              } else {
                emit({
                  timestamp: new Date().toISOString(),
                  type: 'set',
                  property: String(prop),
                  originalValue: originalVal,
                  value,
                  flowName: options.flowName,
                  success: true,
                });
              }
            });

          return true;
        } finally {
          activeTrap = null;
        }
      },

      get: (obj, prop, receiver) => {
        if (prop === IS_PROXY) {
          return true;
        }

        if (activeTrap) {
          return Reflect.get(obj, prop, receiver);
        }

        activeTrap = 'get';
        try {
          const value = Reflect.get(obj, prop, receiver);

          // Emit telemetry if prop is a string/number
          if (typeof prop !== 'symbol') {
            emit({
              timestamp: new Date().toISOString(),
              type: 'get',
              property: String(prop),
              originalValue: value,
              value,
              flowName: options.flowName,
            });
          }

          if (value !== null && typeof value === 'object' && typeof prop === 'string') {
            return ProxyFactory.wrap(value, membrane, options);
          }

          return value;
        } finally {
          activeTrap = null;
        }
      },

      deleteProperty: (obj, prop) => {
        if (activeTrap) {
          return Reflect.deleteProperty(obj, prop);
        }
        activeTrap = 'delete';
        try {
          const commandId = `cmd_delete_${String(prop)}_${Date.now()}`;
          const originalVal = Reflect.get(obj, prop);
          const hasProp = Reflect.has(obj, prop);

          if (!hasProp) {
            return true;
          }

          // Optimistically delete
          const deleteSuccess = Reflect.deleteProperty(obj, prop);
          if (!deleteSuccess) {
            return false;
          }

          if (options.onMutation) {
            options.onMutation(prop, undefined);
          }

          emit({
            timestamp: new Date().toISOString(),
            type: 'delete',
            property: String(prop),
            originalValue: originalVal,
            value: undefined,
            flowName: options.flowName,
            success: undefined,
          });

          const input = {
            property: String(prop),
            action: 'delete',
            flowName: options.flowName,
            fromState: originalVal,
            toState: undefined,
          };

          membrane
            .run('property-deleter', commandId, input, async () => {
              return true;
            })
            .then((res) => {
              if (!res.success) {
                // Rollback delete without receiver
                Reflect.set(obj, prop, originalVal);
                if (options.onMutation) {
                  options.onMutation(prop, originalVal);
                }
                emit({
                  timestamp: new Date().toISOString(),
                  type: 'rollback',
                  property: String(prop),
                  originalValue: undefined,
                  value: originalVal,
                  flowName: options.flowName,
                  success: false,
                  error: res.error || 'Delete denied',
                });
              } else {
                emit({
                  timestamp: new Date().toISOString(),
                  type: 'delete',
                  property: String(prop),
                  originalValue: originalVal,
                  value: undefined,
                  flowName: options.flowName,
                  success: true,
                });
              }
            });

          return true;
        } finally {
          activeTrap = null;
        }
      },

      defineProperty: (obj, prop, descriptor) => {
        if (activeTrap) {
          return Reflect.defineProperty(obj, prop, descriptor);
        }
        activeTrap = 'define';
        try {
          const commandId = `cmd_defineProperty_${String(prop)}_${Date.now()}`;
          const originalVal = Reflect.get(obj, prop);
          const exists = Reflect.has(obj, prop);
          const value = descriptor.value;

          // Optimistically define property
          const defineSuccess = Reflect.defineProperty(obj, prop, descriptor);
          if (!defineSuccess) {
            return false;
          }

          if (options.onMutation) {
            options.onMutation(prop, value);
          }

          emit({
            timestamp: new Date().toISOString(),
            type: 'set',
            property: String(prop),
            originalValue: originalVal,
            value,
            flowName: options.flowName,
            success: undefined,
          });

          const input = {
            property: String(prop),
            value,
            flowName: options.flowName,
            fromState: exists ? originalVal : undefined,
            toState: value,
          };

          membrane
            .run('property-mutator', commandId, input, async () => {
              return true;
            })
            .then((res) => {
              if (!res.success) {
                // Rollback without receiver/proxy traps
                if (exists) {
                  Reflect.set(obj, prop, originalVal);
                  if (options.onMutation) {
                    options.onMutation(prop, originalVal);
                  }
                } else {
                  Reflect.deleteProperty(obj, prop);
                  if (options.onMutation) {
                    options.onMutation(prop, undefined);
                  }
                }
                emit({
                  timestamp: new Date().toISOString(),
                  type: 'rollback',
                  property: String(prop),
                  originalValue: value,
                  value: exists ? originalVal : undefined,
                  flowName: options.flowName,
                  success: false,
                  error: res.error || 'Define denied',
                });
              } else {
                emit({
                  timestamp: new Date().toISOString(),
                  type: 'set',
                  property: String(prop),
                  originalValue: originalVal,
                  value,
                  flowName: options.flowName,
                  success: true,
                });
              }
            });

          return true;
        } finally {
          activeTrap = null;
        }
      },
    };

    const proxy = new Proxy(target, handler);
    proxyCache.set(target, proxy);
    return proxy;
  }
}
