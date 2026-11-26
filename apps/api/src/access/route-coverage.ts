import type { INestApplication } from '@nestjs/common';
import { METHOD_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer, Reflector } from '@nestjs/core';
import { ACCESS_RULE } from './access.decorators';

/**
 * Lists every route with no access rule (api/04). The test suite requires this to be empty, so a
 * new route can't ship without saying who may call it.
 */
export function routesWithoutAccessRule(app: INestApplication): string[] {
  const reflector = new Reflector();
  const missing: string[] = [];
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      const controller = wrapper.metatype as (new (...args: never[]) => unknown) | null;
      if (!controller) continue;
      const proto = controller.prototype as Record<string, unknown>;
      for (const name of Object.getOwnPropertyNames(proto)) {
        const handler = proto[name];
        if (name === 'constructor' || typeof handler !== 'function') continue;
        if (Reflect.getMetadata(METHOD_METADATA, handler) === undefined) continue; // not a route
        const rule = reflector.getAllAndOverride(ACCESS_RULE, [handler, controller]);
        if (!rule)
          missing.push(
            `${controller.name}.${name} (${String(Reflect.getMetadata(PATH_METADATA, handler))})`,
          );
      }
    }
  }
  return missing.sort();
}

/** The names of every controller registered in the running app. */
export function registeredControllers(app: INestApplication): Set<string> {
  const names = new Set<string>();
  for (const module of app.get(ModulesContainer).values()) {
    for (const wrapper of module.controllers.values()) {
      if (wrapper.metatype) names.add(wrapper.metatype.name);
    }
  }
  return names;
}
