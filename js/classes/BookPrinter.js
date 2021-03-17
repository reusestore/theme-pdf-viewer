import {$} from '../libs';

export default class BookPrinter {

  constructor(context, book, styleSheet) {
    this.book = book;
    this.styleSheet = styleSheet;
    this.wnd = context.wnd;
    this.doc = context.doc;
    this.pageCallback = book.getPageCallback();
    const test = this.pageCallback(0);
    this.type = test.type;
    if(this.type==='pdf') {
      this.pdfSrc = test.src.src;
    }
  }

  cancel() {
    this.canceled = true;
  }

  dispose() {
    if(this.frame) {
      this.frame.remove();
      delete this.frame;
    }
  }

  print() {
    delete this.canceled;
    if(this.type==='pdf') {
      let printWnd, callManually = false;
      if(this.useIFrame()) {
        callManually = !!this.frame;
        if(!this.frame) {
          this.frame = $('<iframe src="'+this.pdfSrc+'" style="display: none;"></iframe>').appendTo(this.doc.body);
        }
        printWnd = this.frame[0].contentWindow;
      }
      else {
        printWnd = this.wnd.open(this.pdfSrc);
      }
      if(callManually) {
        printWnd.print();
      }
      else {
        $(printWnd).on('load', ()=> {
          try {
            printWnd.print();
          }
          catch(e) {
            console.error(e);
          }
        });
      }
    }
    else {
      this.renderContent().
        then((content)=> {
          const printWnd = this.wnd.open(),
          printDoc = printWnd.document,
          html = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <title>3D FlipBook - Printing</title>
                ${content.head}
                <script type="text/javascript">
                  function printDocument() {
                    window.print();
                    window.close();
                  }
                  function init() {
                    setTimeout(printDocument, 100);
                  }
                </script>
              </head>
              <body onload="init()">
                ${content.body}
              </body>
            </html>
          `.fb3dQFilter();
          printDoc.open();
          printDoc.write(html);
          printDoc.close();
        }).
        catch((e)=> console.warn('3D FlipBook - Printing was canceled'));
    }
  }

  progress(v) {
    if(this.canceled) {
      throw 'Cancel Printing';
    }
    if(this.onProgress) {
      this.onProgress(Math.floor(v*100));
    }
  }

  renderContent() {
    const pages = this.book.getPages(), head = new Set(), body = [];
    let done = Promise.resolve();
    for(let page=0; page<pages; ++page) {
      const info = this.pageCallback(page);
      if(info.type==='image') {
        done = done.then(()=> {
          this.progress(page/pages);
          return this.renderImage(head, body, info.src);
        });
      }
      else if(info.type==='html') {
        done = done.then(()=> {
          this.progress(page/pages);
          return this.renderHtml(head, body, info.src);
        });
      }
    }
    return done.then(()=> {
      this.progress(1);
      return {head: this.renderHead(head), body: body.join('\n')}
    });
  }

  static wrap(content) {
    return `<div class="fb3d-printer-page">${content}</div>`;
  }

  renderImage(head, body, src) {
    body.push(BookPrinter.wrap(`<img src="${src}" />`));
  }

  renderHtml(head, body, src) {
    return new Promise((resolve, reject)=> {
      $.get(src, (html)=> {
        const links = html.match(/<link.*?>/ig) || [];
        for(let link of links) {
          if(link.match(/stylesheet/i)) {
            const href = link.match(/href\s*=\s*['"](.*)['"]/i);
            if(href) {
              head.add(href[1]);
            }
          }
        }
        const content = html.match(/<body.*?>([\S\s]*)<\/body>/i);
        if(content) {
          body.push(BookPrinter.wrap(content[1]));
        }
        resolve();
      }).fail((e)=> {
        console.error(e.responseText);
        reject();
      });
    })
  }

  renderHead(head) {
    const content = [];
    head.forEach((k)=> content.push(`<link rel="stylesheet" href="${k}">`));
    content.push(this.styleSheet? `<link rel="stylesheet" href="${this.styleSheet}">`: BookPrinter.defaultStyleSheet());
    return content.join('\n');
  }

  useIFrame() {
    const isChromium = this.wnd.chrome,
      winNav = this.wnd.navigator,
      vendorName = winNav.vendor,
      isIEedge = winNav.userAgent.indexOf("Edge")>-1,
      isIOSChrome = winNav.userAgent.match("CriOS");
    let use;
    if(isIOSChrome){
      use = true;
    } else if(isChromium && vendorName==='Google Inc.' && !isIEedge) {
      use = true;
    } else {
      use = false;
    }
    return use;
  }

  static defaultStyleSheet() {
    return `
      <style type="text/css">
        body {
          margin: 0;
          padding: 0;
        }
        .fb3d-printer-page {
          page-break-after: always;
        }
      </style>
    `.fb3dQFilter();
  }

}
