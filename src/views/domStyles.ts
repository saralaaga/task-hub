export function setCssProps(element: HTMLElement | SVGElement, props: Record<string, string>): void {
  element.setCssProps(props);
}

export function setCssStyles(element: HTMLElement | SVGElement, styles: Partial<CSSStyleDeclaration>): void {
  element.setCssStyles(styles);
}
