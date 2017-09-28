function elm(tag, attrs, children, props) {
  const el = document.createElement(tag)
  for (const k in attrs) {
    el.setAttribute(k, attrs[k])
  }

  if (children) {
    children = Array.isArray(children) ? children : [children]
    for (let child of children) {
      if (typeof child === 'string') {
        child = document.createTextNode(child)
      }
      el.appendChild(child)
    }
  }

  if (props) {
    for (const k in props) {
      el[k] = props[k]
    }
  }
  return el
}

class ListView extends Chart {
  navigateTo(path, current) {
    this.path = path
    this.current = current

    const nodes = current._children || current.children || []
    this.nodes = nodes.slice().sort((a, b) => {
      if (a.value < b.value) return 1
      if (a.value > b.value) return -1
      return 0
    })

    this.draw(this.path, this.current)
  }

  draw(path, current) {
    const INITIAL_LOAD = 10

    const navs = [
      elm('h5', { class: 'nav-group-title' }, `${path.join('/')} ${format(current.value)}`, {
        onclick: () => State.navigateTo(path.slice(0, -1))
      })
    ]

    const highlighted = this.highlightedPath

    const check_path =
      highlighted && highlighted.length > path.length && !path.some((p, i) => p !== highlighted[i])
        ? highlighted[path.length]
        : null

    // let str = '----------\n'
    const nodes = this.nodes
    nodes.slice(0, INITIAL_LOAD).forEach(child => {
      // str += child.name + '\t' + format(child.value) + '\n'

      navs.push(
        elm(
          'span',
          {
            class: `nav-group-item${check_path == child.name ? ' active' : ''}`,
            href: '#'
          },
          [
            elm('span', { class: 'icon icon-record', style: `color: ${fill(child)};` }),
            child.name || '',
            elm('span', { class: '', style: 'float:right;' }, format(child.value))
          ],
          {
            onmousedown: () => {
              console.log('click', child)
              child.children && State.navigateTo([...path, child.name])
            },
            onmouseenter: () => State.highlightPath([...path, child.name]),
            onmouseleave: () => State.highlightPath()
          }
        )
      )
    })

    const remaining = nodes.length - INITIAL_LOAD
    if (remaining > 0) {
      navs.push(
        elm('span', { class: 'nav-group-item', href: '#' }, [
          elm('span', { class: 'icon icon-record' }),
          `and ${remaining} other items....`
        ])
      )
    }

    // log(str)
    ;[...sidebar.childNodes].forEach(v => v.remove())
    const nav = elm('nav', { class: 'nav-group' }, navs)
    sidebar.appendChild(nav)
  }

  highlightPath(path) {
    this.highlightedPath = path
    this.draw(this.path, this.current)
  }

  cleanup() {
    this.path = null
    this.current = null
    this.highlightedPath = null
  }
}
