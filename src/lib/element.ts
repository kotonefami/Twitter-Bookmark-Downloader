/**
 * 要素を待機します。
 * @param selector セレクタ
 * @param parentElement 監視する親要素
 */
export async function waitForElement<T extends Element>(selector: string, parentElement: Document | Element = document): Promise<NodeListOf<T>> {
    if (parentElement.querySelectorAll(selector).length !== 0) {
        return parentElement.querySelectorAll(selector);
    } else {
        return await new Promise((resolve) => {
            const observer = new MutationObserver(() => {
                const matchedAddedNodes = parentElement.querySelectorAll<T>(selector);
                if (matchedAddedNodes.length !== 0) {
                    observer.disconnect();
                    resolve(matchedAddedNodes);
                }
            });
            observer.observe(parentElement, { subtree: true, childList: true });
        });
    }
}

/**
 * （未来に追加される要素を含んだ）すべての要素に対して動作を行います。
 * @param selector セレクタ
 * @param event イベント
 * @param parentElement 監視する親要素
 * @param once 一度検出したら終了するかどうか
 */
export function runWithAllElement<T extends Element>(selector: string, event: ((node: T) => void), parentElement?: Document | Element, once?: boolean) {
    (parentElement ?? document).querySelectorAll<T>(selector).forEach(event);
    const observer = new MutationObserver(mutations => {
        const addedElements = mutations.map(mutation => Array.from(mutation.addedNodes)).flat().filter((node: unknown): node is Element => node instanceof Element);

        // NOTE: addedNodes に含まれている要素の中で、のセレクタにマッチする要素を調べる
        addedElements.filter(node => node.matches(selector))
            .forEach((value: Element) => {
                if (once) observer.disconnect();
                event(value as T);
            });
        // NOTE: addedNodes に含まれている要素の子要素の中で、Setで重複を排除しつつセレクタにマッチする要素を調べる
        new Set(addedElements.map(element => [...element.querySelectorAll(selector)]).flat()).forEach((value: Element) => {
            if (once) observer.disconnect();
            event(value as T);
        });
    });
    observer.observe((parentElement ?? document), { subtree: true, childList: true });
}
