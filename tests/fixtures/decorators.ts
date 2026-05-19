import { createClassDecorator } from "../../src/factories/class-decorator";
import { createMethodDecorator } from "../../src/factories/method-decorator";
import { createPropertyDecorator } from "../../src/factories/property-decorator";

export const ClassTag = createClassDecorator<string>();
export const MethodRoute = createMethodDecorator<string>();
export const PropertyColumn = createPropertyDecorator<string>();
