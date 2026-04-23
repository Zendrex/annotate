import { createClassDecorator, createMethodDecorator, createPropertyDecorator } from "../../src";

export const ClassTag = createClassDecorator<string>();
export const MethodRoute = createMethodDecorator<string>();
export const PropertyColumn = createPropertyDecorator<string>();
