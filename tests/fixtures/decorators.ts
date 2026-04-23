import "reflect-metadata";

import {
	createClassDecorator,
	createMethodDecorator,
	createParameterDecorator,
	createPropertyDecorator,
} from "../../src";

/** Shared string decorators for cross-module integration tests. */
export const ClassTag = createClassDecorator<string>();
export const MethodRoute = createMethodDecorator<string>();
export const PropertyColumn = createPropertyDecorator<string>();
export const ParamInject = createParameterDecorator<string>();
