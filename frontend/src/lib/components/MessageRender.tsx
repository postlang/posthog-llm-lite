import React from 'react'
import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkMath from 'remark-math'
import remarkGfm from 'remark-gfm'
import remarkBreaks from 'remark-breaks'

export const MessageRender = memo((props) => {
    return (
        <ReactMarkdown
            className="z-ui-markdown"
            style={{ textAlign: 'justify' }}
            remarkPlugins={[remarkMath, remarkGfm, remarkBreaks]}
        >
            {props.children}
        </ReactMarkdown>
    )
})

MessageRender.displayName = 'MessageRender'
export default MessageRender
