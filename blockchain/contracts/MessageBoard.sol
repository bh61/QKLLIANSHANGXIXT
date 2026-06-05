// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract MessageBoard {
    uint256 private constant MAX_MESSAGE_LENGTH = 100;

    struct Message {
        address author;
        string content;
        uint256 timestamp;
    }

    Message[] private messages;

    event MessagePosted(
        address indexed author,
        string content,
        uint256 timestamp
    );

    function postMessage(string calldata content) external {
        bytes memory contentBytes = bytes(content);
        require(contentBytes.length > 0, "Message cannot be empty");
        require(contentBytes.length <= MAX_MESSAGE_LENGTH, "Message too long");

        Message memory newMessage = Message({
            author: msg.sender,
            content: content,
            timestamp: block.timestamp
        });

        messages.push(newMessage);
        emit MessagePosted(
            newMessage.author,
            newMessage.content,
            newMessage.timestamp
        );
    }

    function getMessageCount() external view returns (uint256) {
        return messages.length;
    }

    function getMessage(
        uint256 index
    )
        external
        view
        returns (address author, string memory content, uint256 createdAt)
    {
        require(index < messages.length, "Message index out of range");

        Message storage message = messages[index];
        return (message.author, message.content, message.timestamp);
    }
}