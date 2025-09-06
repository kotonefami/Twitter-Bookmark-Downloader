import { waitForElement, runWithAllElement } from "./lib/element.ts";
import { Tweet } from "./lib/twitter.ts";

const styleTag = document.createElement("style");
styleTag.textContent = `
.twbd-button {
    background: none;
    border: none;
    cursor: pointer;

    display: flex;
    align-items: center;

    width: 1.25em;
    height: 1.25em;
    align-self: center;

    position: relative;
}
.twbd-button::before {
    content: "";
    display: block;
    position: absolute;
    top: -8px;
    left: -8px;
    right: -8px;
    bottom: -8px;
    border-radius: 1000px;
    transition-duration: 0.2s;
}
/* NOTE: /photo/ は画像にしか通用しません。このaの下に[data-testid="tweetPhoto"]があるのでそれでの絞り込みも無理。 */
a[href*="/photo/"] .twbd-button {
    position: absolute;
    right: 12px;
    bottom: 12px;
    color: #ffffff;
}
a[href*="/photo/"] .twbd-button::before {
    backdrop-filter: blur(5px) contrast(0.5);
    border: 1px solid currentColor;
}
.twbd-button svg {
    width: 100%;
    height: auto;
    opacity: 0.6;
}
.twbd-button:hover::before {
    background-color: rgb(239, 243, 244, 0.1);
}
.twbd-button:active::before {
    background-color: rgb(239, 243, 244, 0.2);
}
</style>
`;
waitForElement("head").then(head => head[0].appendChild(styleTag));

const downloadButtonTemplate = new DOMParser().parseFromString(`
    <div class="twbd-button twbd-tweet-download-button">
        <svg xmlns="http://www.w3.org/2000/svg" class="icon icon-tabler icon-tabler-download" width="44" height="44" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" fill="none" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-2" />
            <path d="M7 11l5 5l5 -5" />
            <path d="M12 4l0 12" />
        </svg>
    </div>
`, "text/html").body.children[0];

runWithAllElement<HTMLElement>('article[data-testid="tweet"]', element => {
    runWithAllElement<HTMLAnchorElement>('a[href*="/photo/"]', element => {
        const downloadButton = element.appendChild(downloadButtonTemplate.cloneNode(true)) as HTMLDivElement;
        downloadButton.onclick = async evt => {
            evt.preventDefault();

            const tweet = new Tweet(element.closest('[data-testid="tweet"]')!);

            const mediaList = await tweet.getMediaList();
            const mediaIndex = parseInt(/\/(\d+)$/.exec(element.href)?.[1] ?? "0") - 1;
            const media = mediaList[mediaIndex];

            const a = document.createElement("a");
            a.target = "_blank";
            a.href = URL.createObjectURL(await (await fetch(media.getOriginalUrl())).blob());
            a.download = `${(await tweet.getAuthor()).screenName}-${tweet.id}-${mediaIndex}.${media.extension}`;
            a.click();
        };
    }, element, true);
});
