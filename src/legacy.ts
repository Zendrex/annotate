import { createAccessorInterceptor, createAccessorListInterceptor } from "./factories/accessor-interceptor";
import { createClassDecorator, createClassListDecorator } from "./factories/class-decorator";
import {
	applyFieldInterceptors,
	createFieldInterceptor,
	createFieldListInterceptor,
} from "./factories/field-interceptor";
import { createMethodDecorator, createMethodListDecorator } from "./factories/method-decorator";
import { createMethodInterceptor, createMethodListInterceptor } from "./factories/method-interceptor";
import { createPropertyDecorator, createPropertyListDecorator } from "./factories/property-decorator";

const withList = <U extends object, L>(unique: U, list: L): U & { list: L } => Object.assign(unique, { list });

/** @internal Legacy factory registry retained for lower-level implementation tests. */
export const decorate = Object.freeze({
	class: withList(createClassDecorator, createClassListDecorator),
	method: withList(createMethodDecorator, createMethodListDecorator),
	property: withList(createPropertyDecorator, createPropertyListDecorator),
} as const);

/** @internal Legacy interceptor registry retained for lower-level implementation tests. */
export const intercept = Object.freeze({
	method: withList(createMethodInterceptor, createMethodListInterceptor),
	accessor: withList(createAccessorInterceptor, createAccessorListInterceptor),
	field: Object.assign(withList(createFieldInterceptor, createFieldListInterceptor), {
		apply: applyFieldInterceptors,
	}),
} as const);
