import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.connect();

describe("MessageBoard", function () {
  it("Should start with zero messages", async function () {
    const messageBoard = await ethers.deployContract("MessageBoard");
    expect(await messageBoard.getMessageCount()).to.equal(0);
  });

  it("Should store a new message and emit an event", async function () {
    const messageBoard = await ethers.deployContract("MessageBoard");
    const [author] = await ethers.getSigners();
    const content = "Hello Blockchain!";

    await expect(messageBoard.postMessage(content))
      .to.emit(messageBoard, "MessagePosted")
      .withArgs(author.address, content, anyUint);

    expect(await messageBoard.getMessageCount()).to.equal(1);

    const [storedAuthor, storedContent, createdAt] =
      await messageBoard.getMessage(0);
    expect(storedAuthor).to.equal(author.address);
    expect(storedContent).to.equal(content);
    expect(createdAt).to.be.greaterThan(0n);
  });

  it("Should reject an empty message", async function () {
    const messageBoard = await ethers.deployContract("MessageBoard");

    await expect(messageBoard.postMessage("")).to.be.revertedWith(
      "Message cannot be empty",
    );
  });

  it("Should reject a message longer than 100 characters", async function () {
    const messageBoard = await ethers.deployContract("MessageBoard");
    const content = "a".repeat(101);

    await expect(messageBoard.postMessage(content)).to.be.revertedWith(
      "Message too long",
    );
  });

  it("Should reject querying an out-of-range index", async function () {
    const messageBoard = await ethers.deployContract("MessageBoard");

    await expect(messageBoard.getMessage(0)).to.be.revertedWith(
      "Message index out of range",
    );
  });
});

const anyUint = (value: bigint): boolean => value > 0n;