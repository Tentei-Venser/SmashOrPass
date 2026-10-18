import React from 'react'
import ReactDOM from 'react-dom/client'
import { Control } from './Control'
import { Display } from './Display'
import './styles.css'

const view = new URLSearchParams(window.location.search).get('view')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{view === 'display' ? <Display /> : <Control />}</React.StrictMode>,
)
